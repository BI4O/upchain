import { initializeScanner } from '@/lib/scanner';

// 标记扫描器是否已初始化
let isInitialized = false;

export function startScanner() {
  if (isInitialized) {
    return;
  }
  
  try {
    console.log('启动区块扫描器...');
    initializeScanner();
    isInitialized = true;
  } catch (error) {
    console.error('启动区块扫描器失败:', error);
  }
} 