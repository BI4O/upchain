/**
 * 扫描器初始化脚本
 * 这个脚本用于在应用启动时初始化区块链扫描器
 */

import { initializeScanner } from '@/lib/scanner';

console.log('正在启动区块链扫描器...');
initializeScanner()
  .then(() => {
    console.log('区块链扫描器已成功启动，每5秒将扫描一次新区块');
  })
  .catch((error) => {
    console.error('启动区块链扫描器失败:', error);
  }); 