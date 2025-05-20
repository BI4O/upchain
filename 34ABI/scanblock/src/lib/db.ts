import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src/data/events.json');

export interface TransferEvent {
  blockNumber: bigint;
  from: string;
  to: string;
  value: string;
  transactionHash: string;
  logIndex: number;
  createdAt: string;
}

// 确保数据库文件存在
function ensureDbFileExists(): void {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('数据库文件不存在，正在创建...');
      fs.writeFileSync(DB_PATH, '[]', 'utf8');
      console.log('已创建空数据库文件:', DB_PATH);
    }
  } catch (error) {
    console.error('创建数据库文件失败:', error);
  }
}

// 读取所有事件
export async function getAllEvents(): Promise<TransferEvent[]> {
  try {
    ensureDbFileExists();
    
    const data = fs.readFileSync(DB_PATH, 'utf8');
    console.log(`读取数据库文件，内容长度: ${data.length} 字节`);
    
    if (!data || data.trim() === '') {
      console.log('数据库文件为空，返回空数组');
      return [];
    }
    
    const events = JSON.parse(data, (key, value) => {
      if (key === 'blockNumber' && typeof value === 'string') {
        return BigInt(value);
      }
      return value;
    });
    
    console.log(`成功读取 ${events.length} 个事件`);
    return events;
  } catch (error) {
    console.error('读取事件数据失败:', error);
    // 如果出错，尝试修复数据库文件
    try {
      fs.writeFileSync(DB_PATH, '[]', 'utf8');
      console.log('重置数据库文件为空数组');
    } catch {
      // 忽略二次错误
    }
    return [];
  }
}

// 按地址筛选事件
export async function getEventsByAddress(address: string): Promise<TransferEvent[]> {
  const events = await getAllEvents();
  const normalizedAddress = address.toLowerCase();
  console.log(`筛选与地址 ${normalizedAddress} 相关的事件`);
  
  const filteredEvents = events.filter(
    event => 
      event.from.toLowerCase() === normalizedAddress || 
      event.to.toLowerCase() === normalizedAddress
  );
  
  console.log(`找到 ${filteredEvents.length} 个相关事件`);
  return filteredEvents;
}

// 保存新事件，避免重复
export async function saveEvents(newEvents: TransferEvent[]): Promise<void> {
  try {
    ensureDbFileExists();
    console.log(`准备保存 ${newEvents.length} 个新事件`);
    
    const currentEvents = await getAllEvents();
    console.log(`当前数据库中有 ${currentEvents.length} 个事件`);
    
    // 检查是否有新事件，避免重复
    const existingKeys = new Set(
      currentEvents.map(event => `${event.transactionHash}-${event.logIndex}`)
    );
    
    const uniqueNewEvents = newEvents.filter(
      event => !existingKeys.has(`${event.transactionHash}-${event.logIndex}`)
    );
    
    console.log(`过滤后有 ${uniqueNewEvents.length} 个唯一新事件`);
    
    if (uniqueNewEvents.length === 0) {
      console.log('没有新事件需要保存');
      return;
    }
    
    // 合并并排序事件
    const allEvents = [...currentEvents, ...uniqueNewEvents].sort(
      (a, b) => Number(a.blockNumber - b.blockNumber)
    );
    
    // 保存到 JSON 文件
    const jsonContent = JSON.stringify(allEvents, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2);
    
    fs.writeFileSync(DB_PATH, jsonContent);
    console.log(`已保存 ${uniqueNewEvents.length} 个新事件，数据库现在有 ${allEvents.length} 个事件`);
  } catch (error) {
    console.error('保存事件数据失败:', error);
  }
} 