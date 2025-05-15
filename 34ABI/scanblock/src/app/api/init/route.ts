import { NextResponse } from 'next/server';
import { startScanner } from '@/app/scanner';

// 初始化标志
let initialized = false;

export async function GET() {
  try {
    if (!initialized) {
      // 启动扫描器
      startScanner();
      initialized = true;
      return NextResponse.json({ status: 'success', message: '扫描器已启动' });
    }
    
    return NextResponse.json({ status: 'success', message: '扫描器已在运行' });
  } catch (error) {
    console.error('初始化失败:', error);
    return NextResponse.json(
      { error: '初始化失败' },
      { status: 500 }
    );
  }
} 