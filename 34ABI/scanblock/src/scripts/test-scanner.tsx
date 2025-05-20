/**
 * 这是一个独立的测试脚本，用于测试区块链扫描功能
 * 运行方式：
 * npx tsx src/scripts/test-scanner.tsx
 */

import { createPublicClient, http, parseAbi } from "viem";
import { foundry } from "viem/chains";
import fs from 'fs';
import path from 'path';

// 数据库路径
const DB_PATH = path.join(process.cwd(), 'src/data/events.json');

// 合约地址和RPC URL
const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`;
const rpcUrl = 'http://localhost:8545';

console.log('测试扫块脚本启动...');
console.log(`合约地址: ${contractAddress}`);
console.log(`RPC URL: ${rpcUrl}`);
console.log(`数据库路径: ${DB_PATH}`);

// 检查数据库文件是否存在
if (fs.existsSync(DB_PATH)) {
  console.log('数据库文件存在');
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    console.log('数据库内容:', data);
  } catch (err) {
    console.error('读取数据库文件失败:', err);
  }
} else {
  console.log('数据库文件不存在，将创建新文件');
  try {
    fs.writeFileSync(DB_PATH, '[]', 'utf8');
    console.log('已创建空数据库文件');
  } catch (err) {
    console.error('创建数据库文件失败:', err);
  }
}

// 创建区块链客户端
const client = createPublicClient({
  chain: foundry,
  transport: http(rpcUrl),
});

// 测试连接
async function testBlockchainConnection() {
  try {
    console.log('测试区块链连接...');
    const blockNumber = await client.getBlockNumber();
    console.log(`当前区块号: ${blockNumber}`);
    
    // 获取链信息
    const chainId = await client.getChainId();
    console.log(`链ID: ${chainId}`);
    
    return true;
  } catch (error) {
    console.error('连接区块链失败:', error);
    return false;
  }
}

// 扫描区块
async function scanBlocks() {
  try {
    console.log('开始扫描区块...');
    
    // 获取当前区块号
    const currentBlock = await client.getBlockNumber();
    console.log(`当前区块号: ${currentBlock}`);
    
    // 获取指定区块范围内的事件日志
    console.log(`扫描从 0 到 ${currentBlock} 的区块`);
    
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
      fromBlock: BigInt(0),
      toBlock: currentBlock,
    });
    
    console.log(`找到 ${logs.length} 条日志`);
    
    for (const log of logs) {
      console.log('-----------------------------------');
      console.log(`区块号: ${log.blockNumber}`);
      console.log(`交易哈希: ${log.transactionHash}`);
      console.log(`日志索引: ${log.logIndex}`);
      console.log(`发送地址: ${log.args.from || '未知'}`);
      console.log(`接收地址: ${log.args.to || '未知'}`);
      console.log(`金额: ${log.args.value?.toString() || '0'}`);
    }
    
    // 保存事件到数据库
    if (logs.length > 0) {
      const events = logs.map(log => ({
        blockNumber: log.blockNumber.toString(),
        from: log.args.from || '0x0000000000000000000000000000000000000000',
        to: log.args.to || '0x0000000000000000000000000000000000000000',
        value: (log.args.value || BigInt(0)).toString(),
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        createdAt: new Date().toISOString(),
      }));
      
      fs.writeFileSync(DB_PATH, JSON.stringify(events, null, 2), 'utf8');
      console.log(`已保存 ${events.length} 个事件到数据库`);
    }
    
  } catch (error) {
    console.error('扫描区块失败:', error);
  }
}

// 主函数
async function main() {
  const connected = await testBlockchainConnection();
  
  if (connected) {
    await scanBlocks();
  } else {
    console.log('无法连接到区块链，请检查 RPC URL 和网络状态');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 