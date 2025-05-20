import { NextRequest, NextResponse } from 'next/server';
import { getEventsByAddress } from '@/lib/db';

// 定义params类型
interface Params {
  params: {
    address: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    // 从URL路径获取地址参数
    const address = params.address;
    
    console.log('API请求地址:', address);
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: '无效的地址格式' },
        { status: 400 }
      );
    }
    
    const events = await getEventsByAddress(address);
    console.log(`找到 ${events.length} 个相关事件`);
    
    // 将 BigInt 转换为字符串，以便 JSON 序列化
    const serializedEvents = events.map(event => ({
      ...event,
      blockNumber: event.blockNumber.toString(),
      value: event.value // 确保value已经是字符串
    }));
    
    return NextResponse.json(serializedEvents);
  } catch (error) {
    console.error('获取账户事件失败:', error);
    return NextResponse.json(
      { error: '获取账户事件失败', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 