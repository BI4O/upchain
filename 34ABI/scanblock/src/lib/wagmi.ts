import { http, createConfig } from 'wagmi';
import { foundry } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// 创建 Wagmi 配置
export const config = createConfig({
  chains: [foundry],
  connectors: [injected()],
  transports: {
    [foundry.id]: http(process.env.NEXT_PUBLIC_ANVIL_RPC_URL),
  },
}); 