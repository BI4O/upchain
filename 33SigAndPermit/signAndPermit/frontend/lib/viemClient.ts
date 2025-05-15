import { createPublicClient, http } from 'viem';
import { foundry } from 'viem/chains';

// 创建连接到anvil本地网络的公共客户端
export const publicClient = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
}); 