import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem';
import { foundry } from 'viem/chains';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { Adapter } from 'lowdb';

// 获取当前文件夹路径
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbFile = join(__dirname, 'blocks.json');
const transfersFile = join(__dirname, 'transfers.json');

// 合约地址
const tokenAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Transfer事件ABI
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

// 自定义BigInt序列化函数
const reviver = (_key: string, value: any) => {
  // 将BigInt字符串转回普通数字
  return typeof value === 'string' && /^\d+n$/.test(value)
    ? BigInt(value.slice(0, -1))
    : value;
};

const replacer = (_key: string, value: any) => {
  // 将BigInt转为字符串表示
  return typeof value === 'bigint'
    ? value.toString() + 'n'
    : value;
};

// 创建 lowdb 实例
type BlockData = {
  blocks: Array<any>
}

type TransferData = {
  transfers: Record<string, Record<string, Array<{
    blockNumber: string;
    from: string;
    to: string;
    value: string;
    transactionHash: string;
    logIndex: string;
  }>>>
}

// 自定义JSONFile适配器选项
interface JSONFileOptions {
  serialize: (data: any) => string;
  deserialize: (text: string) => any;
}

// 创建适配器实例
class CustomJSONFile<T> extends JSONFile<T> {
  serialize: (data: any) => string;
  deserialize: (text: string) => any;
  
  constructor(filename: string, options: JSONFileOptions) {
    super(filename);
    this.serialize = options.serialize;
    this.deserialize = options.deserialize;
  }
}

const adapter = new CustomJSONFile<BlockData>(dbFile, {
  serialize: (data: any) => JSON.stringify(data, replacer, 2),
  deserialize: (text: string) => JSON.parse(text, reviver)
});

const transfersAdapter = new CustomJSONFile<TransferData>(transfersFile, {
  serialize: (data: any) => JSON.stringify(data, replacer, 2),
  deserialize: (text: string) => JSON.parse(text, reviver)
});

const db = new Low<BlockData>(adapter, { blocks: [] });
const transfersDb = new Low<TransferData>(transfersAdapter, { transfers: {} });

// 创建客户端
const client = createPublicClient({ chain: foundry, transport: http() });

/**
 * 保存最近 N 个区块到 lowdb
 */
export async function saveLatestBlocks(limit = 5) {
  // 读取数据库
  await db.read();
  await transfersDb.read();
  
  const latestBlock = await client.getBlockNumber();
  const seen = new Set(db.data.blocks.map(b => Number(b.number)));
  
  // 获取新区块
  for (let i = 0; i < limit; i++) {
    const blockNumber = latestBlock - BigInt(i);
    if (seen.has(Number(blockNumber))) continue;
    
    const block = await client.getBlock({ blockNumber });
    
    // 将大整数转为字符串再存储
    const blockData = JSON.parse(JSON.stringify(block, replacer));
    db.data.blocks.push(blockData);
  }
  
  // 按区块号从大到小排序并保留最新的 limit 个
  db.data.blocks = db.data.blocks
    .sort((a, b) => Number(b.number) - Number(a.number))
    .slice(0, limit);
  
  // 获取指定合约的Transfer事件
  await getContractTransferEvents(limit);
  
  // 保存到数据库
  await db.write();
  await transfersDb.write();
  console.log(`✅ 已更新区块数据（共 ${db.data.blocks.length} 个）`);
  console.log(`📊 已更新转账记录`);
}

/**
 * 使用 getLogs 获取指定合约的 Transfer 事件
 */
async function getContractTransferEvents(blockLimit = 5) {
  const latestBlock = await client.getBlockNumber();
  const fromBlock = latestBlock - BigInt(blockLimit - 1);
  
  console.log(`🔎 获取从区块 ${fromBlock} 到 ${latestBlock} 的 Transfer 事件...`);
  
  try {
    // 首先清空这个范围的区块中的转账记录，避免重复
    if (!transfersDb.data.transfers) {
      transfersDb.data.transfers = {};
    }
    
    // 清空要处理的区块范围内的转账记录
    for (let i = Number(fromBlock); i <= Number(latestBlock); i++) {
      if (transfersDb.data.transfers[i.toString()]) {
        delete transfersDb.data.transfers[i.toString()];
      }
    }
    
    // 使用 getLogs 方法获取指定合约的 Transfer 事件
    const logs = await client.getLogs({
      address: tokenAddr as `0x${string}`,
      event: transferEvent,
      fromBlock,
      toBlock: latestBlock
    });
    
    console.log(`✅ 获取到 ${logs.length} 个 Transfer 事件`);
    
    // 处理每个事件日志
    for (const log of logs) {
      const blockNumber = log.blockNumber.toString();
      
      // 确保 args 存在且有所需字段
      if (log.args && 'from' in log.args && 'to' in log.args && 'value' in log.args) {
        const { from, to, value } = log.args;
        
        if (from && to && value) {
          // 记录转账信息
          const transfer = {
            blockNumber,
            from: from.toLowerCase(),
            to: to.toLowerCase(),
            value: value.toString(),
            transactionHash: log.transactionHash,
            logIndex: log.logIndex.toString()
          };
          
          // 为发送方和接收方添加记录
          [from.toLowerCase(), to.toLowerCase()].forEach(address => {
            if (!transfersDb.data.transfers[blockNumber]) {
              transfersDb.data.transfers[blockNumber] = {};
            }
            
            if (!transfersDb.data.transfers[blockNumber][address]) {
              transfersDb.data.transfers[blockNumber][address] = [];
            }
            
            transfersDb.data.transfers[blockNumber][address].push(transfer);
          });
        }
      }
    }
  } catch (error) {
    console.error('获取 Transfer 事件出错:', error);
  }
}

// 获取指定区块和地址的所有转账记录
export async function getTransfersByBlockAndAddress(blockNumber: string, address: string): Promise<any[]> {
  await transfersDb.read();
  
  const normalizedAddress = address.toLowerCase();
  const transfers = transfersDb.data.transfers[blockNumber]?.[normalizedAddress] || [];
  
  return transfers;
}

// 直接运行测试 (ESM方式)
// 检查当前是否为主模块
if (import.meta.url === `file://${process.argv[1]}`) {
  saveLatestBlocks()
    .then(() => console.log('区块数据已保存'))
    .catch(err => console.error('错误:', err));
}