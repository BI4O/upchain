import { createPublicClient, http, parseAbi, type Log } from "viem";
import { foundry } from "viem/chains";
import { saveEvents, TransferEvent } from "./db";

// 读取环境变量
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const rpcUrl = process.env.NEXT_PUBLIC_ANVIL_RPC_URL as string;

console.log(`初始化扫描器配置:`);
console.log(`- 合约地址: ${contractAddress}`);
console.log(`- RPC URL: ${rpcUrl}`);

// 解析转账事件 ABI
const abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

// 创建区块链客户端
const client = createPublicClient({
  chain: foundry,
  transport: http(rpcUrl),
});

// 上次扫描的区块号
let lastScannedBlock = BigInt(0);
// 记录扫描器是否运行中的标志
let isScanning = false;

// 扫描新区块并保存事件
export async function scanBlocks(): Promise<void> {
  // 如果已经有一个扫描任务在运行，则跳过本次扫描
  if (isScanning) {
    console.log('扫描任务已在运行中，跳过本次扫描');
    return;
  }

  try {
    isScanning = true;

    // 获取当前区块号
    const currentBlock = await client.getBlockNumber();
    
    // 如果没有新区块，则跳过
    if (currentBlock <= lastScannedBlock) {
      console.log(`没有新区块，当前区块: ${currentBlock}`);
      isScanning = false;
      return;
    }
    
    // 扫描范围不要太大，避免请求超时
    const fromBlock = lastScannedBlock;
    const toBlock = currentBlock;
    
    console.log(`扫描从 ${fromBlock} 到 ${toBlock} 的区块`);
    
    try {
      // 获取指定区块范围内的事件日志
      const logs = await client.getLogs({
        address: contractAddress,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'to', indexed: true }, 
            { type: 'uint256', name: 'value', indexed: false }
          ]
        },
        fromBlock: fromBlock,
        toBlock: toBlock,
      });
      
      console.log(`发现 ${logs.length} 个日志事件`);
      
      // 如果有日志，则记录详细信息
      if (logs.length > 0) {
        for (const log of logs) {
          console.log('-----------------------------------');
          console.log(`区块号: ${log.blockNumber}`);
          console.log(`交易哈希: ${log.transactionHash}`);
          console.log(`日志索引: ${log.logIndex}`);
          console.log(`发送地址: ${log.args.from || '未知'}`);
          console.log(`接收地址: ${log.args.to || '未知'}`);
          console.log(`金额原始值: ${log.args.value?.toString() || '0'}`);
          
          // 转为 ether 单位进行打印，方便调试
          try {
            const wei = log.args.value || BigInt(0);
            const etherValue = Number(wei) / 10**18;
            console.log(`金额 (ether): ${etherValue}`);
          } catch (e) {
            console.error('金额转换失败:', e);
          }
        }
        
        // 转换日志格式
        const events: TransferEvent[] = logs.map(log => {
          const value = log.args.value || BigInt(0);
          console.log(`处理交易: ${log.transactionHash}, 金额: ${value.toString()}`);
          
          return {
            blockNumber: log.blockNumber,
            from: log.args.from || '0x0000000000000000000000000000000000000000',
            to: log.args.to || '0x0000000000000000000000000000000000000000',
            value: value.toString(),
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            createdAt: new Date().toISOString(),
          };
        });
        
        // 保存到 JSON 数据库
        await saveEvents(events);
        console.log(`已保存 ${events.length} 个事件到数据库`);
      } else {
        console.log('没有发现新事件');
      }
      
      // 更新最后扫描的区块号
      lastScannedBlock = currentBlock + BigInt(1);
      console.log(`扫描完成，下次将从区块 ${lastScannedBlock} 开始扫描`);
    } catch (error) {
      console.error('获取区块日志失败:', error);
      // 部分失败时仍然更新区块号，避免卡住
      lastScannedBlock = currentBlock + BigInt(1);
    }
  } catch (error) {
    console.error('扫描区块失败:', error);
  } finally {
    isScanning = false;
  }
}

// 初始化扫描器
export async function initializeScanner(): Promise<void> {
  try {
    console.log('初始化区块扫描器...');
    
    // 测试区块链连接
    try {
      const blockNumber = await client.getBlockNumber();
      const chainId = await client.getChainId();
      console.log(`成功连接区块链:`);
      console.log(`- 链ID: ${chainId}`);
      console.log(`- 当前区块: ${blockNumber}`);
    } catch (error) {
      console.error('连接区块链失败:', error);
      throw new Error('无法连接到区块链');
    }
    
    // 首次扫描从第 0 个区块开始
    lastScannedBlock = BigInt(0);
    console.log(`开始首次扫描，从区块 ${lastScannedBlock} 开始`);
    await scanBlocks();
    
    // 设置定时任务，每 5 秒扫描一次
    console.log('设置扫描定时任务，每 5 秒扫描一次');
    setInterval(scanBlocks, 5000);
    
    return Promise.resolve();
  } catch (error) {
    console.error('初始化区块扫描器失败:', error);
    return Promise.reject(error);
  }
} 