import { createPublicClient, webSocket, parseAbiItem, type Log, isAddress } from 'viem';
import { localhost } from 'viem/chains';
import NFTMarketABI from '../contracts/NFTMarket.json';

// 配置 viem 客户端
const client = createPublicClient({
  chain: localhost,
  transport: webSocket('ws://127.0.0.1:50494')
});

// NFTMarket 合约地址
const NFTMarketAddress = '0x4826533b4897376654bb4d4ad88b7fafd0c98528';

// 验证合约地址
if (!isAddress(NFTMarketAddress)) {
  throw new Error(`无效的合约地址: ${NFTMarketAddress}。地址应该是 42 个字符（包括 0x 前缀）`);
}

// 监听 NFT 上架事件
const watchListedEvents = async () => {
  try {
    console.log('正在设置上架事件监听器...');
    console.log('合约地址:', NFTMarketAddress);
    
    // 先尝试获取合约代码，确认合约是否存在
    const code = await client.getBytecode({ address: NFTMarketAddress });
    if (!code || code === '0x') {
      console.error('错误：合约地址上没有代码，请确认合约地址是否正确');
      return;
    }
    console.log('合约代码存在，继续设置监听器...');

    await client.watchEvent({
      address: NFTMarketAddress,
      event: parseAbiItem('event NftListed(address indexed seller, uint256 indexed _NftId, uint256 price)'),
      onLogs: (logs) => {
        console.log('收到上架事件日志:', logs);
        logs.forEach((log) => {
          if (log.args.seller && log.args._NftId && log.args.price) {
            console.log('🎨 NFT 上架事件:', {
              卖家: log.args.seller,
              NFT编号: log.args._NftId.toString(),
              价格: log.args.price.toString()
            });
          }
        });
      }
    });
  } catch (error) {
    console.error('监听上架事件出错:', error);
  }
};

// 监听 NFT 售出事件
const watchSoldEvents = async () => {
  try {
    console.log('正在设置售出事件监听器...');
    
    await client.watchEvent({
      address: NFTMarketAddress,
      event: parseAbiItem('event NftSold(address indexed buyer, uint256 indexed _NftId, uint256 price)'),
      onLogs: (logs) => {
        console.log('收到售出事件日志:', logs);
        logs.forEach((log) => {
          if (log.args.buyer && log.args._NftId && log.args.price) {
            console.log('💰 NFT 售出事件:', {
              买家: log.args.buyer,
              NFT编号: log.args._NftId.toString(),
              价格: log.args.price.toString()
            });
          }
        });
      }
    });
  } catch (error) {
    console.error('监听售出事件出错:', error);
  }
};

// 启动监听
const startWatching = async () => {
  console.log('开始监听 NFTMarket 合约事件...');
  console.log('当前网络:', await client.getChainId());
  console.log('当前区块:', await client.getBlockNumber());
  
  await Promise.all([
    watchListedEvents(),
    watchSoldEvents()
  ]);
};

// 导出启动函数
export { startWatching };
