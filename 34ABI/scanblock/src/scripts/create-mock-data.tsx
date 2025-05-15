/**
 * 这是一个生成模拟数据的脚本，用于测试前端显示
 * 运行方式：
 * npx tsx src/scripts/create-mock-data.tsx
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

// 数据库路径
const DB_PATH = path.join(process.cwd(), 'src/data/events.json');

// 生成随机地址
function randomAddress(): string {
  return `0x${randomBytes(20).toString('hex')}`;
}

// 生成随机交易哈希
function randomTransactionHash(): string {
  return `0x${randomBytes(32).toString('hex')}`;
}

// 生成随机 BigInt 值 (0-100 ETH 范围)
function randomValue(): string {
  // 0-100 ETH，以wei为单位 (1 ETH = 10^18 wei)
  const etherAmount = Math.random() * 100;
  const weiAmount = BigInt(Math.floor(etherAmount * 10**18));
  return weiAmount.toString();
}

// 创建模拟数据
async function createMockData(count: number) {
  console.log(`创建 ${count} 条模拟数据...`);
  
  // 固定地址：用于测试账户筛选功能
  const fixedAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  console.log(`固定测试地址: ${fixedAddress}`);
  
  const mockEvents = [];
  
  for (let i = 0; i < count; i++) {
    // 每5个事件，使用一次固定地址作为发送方或接收方
    const useFixedAddress = i % 5 === 0;
    const from = useFixedAddress ? fixedAddress : randomAddress();
    const to = useFixedAddress && i % 10 === 0 ? randomAddress() : (useFixedAddress ? randomAddress() : fixedAddress);
    
    mockEvents.push({
      blockNumber: (10000 + i).toString(),
      from,
      to,
      value: randomValue(),
      transactionHash: randomTransactionHash(),
      logIndex: i,
      createdAt: new Date(Date.now() - i * 60000).toISOString(), // 每条记录间隔1分钟
    });
  }
  
  // 保存到JSON文件
  console.log(`正在写入 ${mockEvents.length} 条模拟数据到 ${DB_PATH}`);
  fs.writeFileSync(DB_PATH, JSON.stringify(mockEvents, null, 2));
  console.log('模拟数据已创建成功！');
}

// 执行主函数
const mockCount = process.argv[2] ? parseInt(process.argv[2]) : 20;
createMockData(mockCount)
  .then(() => console.log('完成'))
  .catch(err => console.error('创建模拟数据失败:', err)); 