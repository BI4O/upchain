import { startWatching } from './NFTmarket';

console.log('正在启动 NFTMarket 事件监听...');

startWatching()
  .then(() => {
    console.log('事件监听已启动，等待事件...');
  })
  .catch((error) => {
    console.error('启动监听时出错:', error);
    process.exit(1);
  }); 