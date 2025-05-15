// 简单的Express REST API服务器
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveLatestBlocks } from './blockScanAndSave.js';

// 初始化
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const app = express();
const PORT = 3006;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // 提供静态文件

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleString();
  console.log(`📝 [${timestamp}] ${req.method} ${req.url}`);
  next();
});

// 读取区块数据
function readBlocksData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'blocks.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取区块数据失败:', error);
    return { blocks: [] };
  }
}

// 读取转账数据
function readTransfersData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'transfers.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取转账数据失败:', error);
    return { transfers: {} };
  }
}

// 获取数据库统计信息
function getDatabaseStats() {
  const blocksData = readBlocksData();
  const transfersData = readTransfersData();
  
  // 计算转账记录总数
  let totalTransfers = 0;
  let addressCount = new Set();
  
  Object.keys(transfersData.transfers || {}).forEach(blockNumber => {
    Object.keys(transfersData.transfers[blockNumber] || {}).forEach(address => {
      addressCount.add(address);
      totalTransfers += transfersData.transfers[blockNumber][address].length;
    });
  });
  
  return {
    blockCount: blocksData.blocks?.length || 0,
    transferCount: totalTransfers,
    uniqueAddressCount: addressCount.size,
    blockNumbers: blocksData.blocks?.map(b => String(b.number).replace('n', ''))?.sort() || []
  };
}

// 路由
app.get('/blocks', (req, res) => {
  console.log('收到GET请求: /blocks');
  const data = readBlocksData();
  console.log(`🔍 获取所有区块 - 返回 ${data.blocks?.length || 0} 个区块`);
  res.json(data.blocks || []);
});

app.get('/blocks/:blockNumber', (req, res) => {
  console.log('收到GET请求: /blocks/' + req.params.blockNumber);
  const data = readBlocksData();
  const blockNumber = req.params.blockNumber;
  const block = data.blocks.find(b => String(b.number).replace('n', '') === blockNumber);
  
  if (!block) {
    console.log(`❌ 区块 ${blockNumber} 未找到`);
    return res.status(404).json({ error: '区块未找到' });
  }
  
  console.log(`🔍 获取区块 ${blockNumber} 的信息 - 找到交易 ${block.transactions?.length || 0} 笔`);
  res.json(block);
});

app.get('/block/:blockNumber/address/:address', (req, res) => {
  console.log(`收到GET请求: /block/${req.params.blockNumber}/address/${req.params.address}`);
  const { blockNumber, address } = req.params;
  const data = readTransfersData();
  
  try {
    const normalizedAddress = address.toLowerCase();
    const transfers = data.transfers[blockNumber]?.[normalizedAddress] || [];
    console.log(`🔍 获取区块 ${blockNumber} 地址 ${address} 的转账记录 - 找到 ${transfers.length} 条`);
    res.json(transfers);
  } catch (error) {
    console.error('获取转账记录失败:', error);
    res.status(500).json({ error: '获取转账记录失败' });
  }
});

// 新增：获取指定地址在所有区块中的转账记录
app.get('/address/:address', (req, res) => {
  console.log('收到GET请求: /address/' + req.params.address);
  const { address } = req.params;
  const data = readTransfersData();
  
  try {
    const normalizedAddress = address.toLowerCase();
    const allTransfers: Array<{
      blockNumber: string;
      from: string;
      to: string;
      value: string;
      transactionHash: string;
      logIndex: string;
    }> = [];
    
    // 遍历所有区块中的转账记录
    Object.keys(data.transfers || {}).forEach(blockNumber => {
      const transfers = data.transfers[blockNumber]?.[normalizedAddress] || [];
      if (transfers.length > 0) {
        allTransfers.push(...transfers);
      }
    });
    
    // 按区块号排序，最新的区块排在前面
    allTransfers.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
    
    console.log(`🔍 获取地址 ${address} 的所有转账记录 - 找到 ${allTransfers.length} 条`);
    res.json({
      address: normalizedAddress,
      totalRecords: allTransfers.length,
      transfers: allTransfers
    });
  } catch (error) {
    console.error('获取转账记录失败:', error);
    res.status(500).json({ error: '获取转账记录失败' });
  }
});

// 新增：获取所有区块中的所有转账记录
app.get('/transfers', (req, res) => {
  console.log('收到GET请求: /transfers', req.query);
  const data = readTransfersData();
  const allTransfers = [];
  
  try {
    // 遍历所有区块中的转账记录
    Object.keys(data.transfers || {}).forEach(blockNumber => {
      Object.keys(data.transfers[blockNumber] || {}).forEach(address => {
        const transfers = data.transfers[blockNumber][address];
        if (transfers.length > 0) {
          allTransfers.push(...transfers);
        }
      });
    });
    
    // 删除重复的记录（通过交易哈希和日志索引去重）
    const uniqueTransfers = allTransfers.filter((transfer, index, self) => 
      index === self.findIndex(t => 
        t.transactionHash === transfer.transactionHash && 
        t.logIndex === transfer.logIndex
      )
    );
    
    // 按区块号排序，最新的区块排在前面
    uniqueTransfers.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
    
    // 默认返回最新的100条记录
    const limit = parseInt(req.query.limit as string) || 100;
    const result = uniqueTransfers.slice(0, limit);
    
    console.log(`🔍 获取所有转账记录 - 找到 ${uniqueTransfers.length} 条，返回 ${result.length} 条`);
    res.json({
      totalRecords: uniqueTransfers.length,
      transfers: result
    });
  } catch (error) {
    console.error('获取转账记录失败:', error);
    res.status(500).json({ error: '获取转账记录失败' });
  }
});

// 获取数据库统计信息的接口
app.get('/stats', (req, res) => {
  console.log('收到GET请求: /stats');
  const stats = getDatabaseStats();
  res.json(stats);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动，监听端口 ${PORT}`);
});
