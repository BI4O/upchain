import { NextResponse } from 'next/server';
import { getAllEvents } from '@/lib/db';

export async function GET() {
  try {
    const events = await getAllEvents();
    
    // 将 BigInt 转换为字符串，以便 JSON 序列化
    const serializedEvents = events.map(event => ({
      ...event,
      blockNumber: event.blockNumber.toString(),
    }));
    
    return NextResponse.json(serializedEvents);
  } catch (error) {
    console.error('获取事件列表失败:', error);
    return NextResponse.json(
      { error: '获取事件列表失败' },
      { status: 500 }
    );
  }
} 