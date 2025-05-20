/**
 * 整合启动脚本
 * 同时启动 Next.js 服务器和区块链扫描器
 */

import { spawn } from 'child_process';
import { initializeScanner } from '../lib/scanner';

// 启动 Next.js 服务器
function startNextServer() {
  console.log('启动 Next.js 服务器...');
  
  const nextProcess = spawn('npx', ['next', 'dev'], {
    stdio: 'inherit',
    shell: true,
  });
  
  nextProcess.on('error', (error) => {
    console.error('Next.js 服务器启动失败:', error);
  });
  
  return nextProcess;
}

// 主函数
async function main() {
  try {
    // 启动 Next.js 服务器
    const nextProcess = startNextServer();
    
    // 等待一段时间，确保 Next.js 服务器已经启动
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 初始化区块链扫描器
    console.log('初始化区块链扫描器...');
    await initializeScanner();
    console.log('区块链扫描器已启动，每 5 秒将扫描一次新区块');
    
    // 处理进程退出
    process.on('SIGINT', () => {
      console.log('正在关闭应用...');
      nextProcess.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error('启动应用失败:', error);
    process.exit(1);
  }
}

// 执行主函数
main(); 