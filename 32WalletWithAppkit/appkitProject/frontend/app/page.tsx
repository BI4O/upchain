'use client';
import { AppKitProvider } from "../config/index";
import { useState, useEffect } from 'react';
import {
    useAccount,
    useDisconnect,
    useChainId,
    useChains,
    useReadContract,
    useWriteContract,
    useClient,
    useBalance,
    useSwitchChain
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

// 导入所有合约ABI
import NFTMarketABI from './contract/NFTMarket_abi.json';
import NFTABI from './contract/NFT_abi.json';
import ERC20tokenABI from './contract/ERC20token_abi.json';
import { useAppKit } from '@reown/appkit/react';
import NavigationBar from "../components/NavigationBar";
import ERC20Card from "../components/ERC20Card";
import NFTCard from "../components/NFTCard";
import NFTMarketCard from "../components/NFTMarketCard";

/*

为 NFTMarket 项目添加前端，并接入 AppKit 进行前端登录，并实际操作使用 WalletConnect 进行登录（需要先安装手机端钱包）。

并在 NFTMarket 前端添加上架操作，切换另一个账号后可使用 Token 进行购买 NFT。
*/

// 合约地址
const marketAddr = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const wallet1Addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // 部署者，持有初始全部代币
const wallet2Addr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

// 使用的ERC20余额显示
const ERC20TokenAddr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const NFTAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// 合约配置对象，供读写合约函数使用
const contractConfig = {
  market: {
    address: marketAddr as `0x${string}`,
    abi: NFTMarketABI
  },
  nft: {
    address: NFTAddr as `0x${string}`,
    abi: NFTABI
  },
  token: {
    address: ERC20TokenAddr as `0x${string}`,
    abi: ERC20tokenABI
  }
};

function Demo() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const chains = useChains();
  const { switchChain } = useSwitchChain();
  const currentChain = chains.find(chain => chain.id === chainId);

  // 找到foundry网络
  const foundryChain = chains.find(chain => chain.name === 'Foundry' || chain.id === 31337);

  // 查余额 - 更新为根据当前链ID和地址查询
  const { data: balance, isLoading } = useBalance({
    address: isConnected ? address : (wallet1Addr as `0x${string}`),
    chainId: chainId
  });

  // 查询ERC20代币余额
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);
  
  // 使用useEffect读取代币余额，避免类型问题
  useEffect(() => {
    if (chainId === 31337) {
      setIsTokenLoading(true);
      
      // 检查当前地址是否为wallet1，只有wallet1有初始代币
      const currentAddress = isConnected ? address : null;
      
      // 直接模拟显示，根据合约逻辑，只有wallet1有初始代币
      setTimeout(() => {
        if (currentAddress?.toLowerCase() === wallet1Addr.toLowerCase()) {
          // wallet1 有 1000个 tokens (1e18 ether == 1000 ethers 单位 == 1000 * 10^18 wei)
          setTokenBalance(BigInt('1000000000000000000000')); 
        } else if (currentAddress) {
          // 其他钱包默认没有代币
          setTokenBalance(BigInt('0'));
        } else {
          // 未连接钱包时，显示wallet1的代币余额
          setTokenBalance(BigInt('1000000000000000000000'));
        }
        setIsTokenLoading(false);
      }, 1000);
    }
  }, [chainId, isConnected, address]);

  // 处理连接到Foundry网络
  const connectToFoundry = () => {
    if (foundryChain) {
      // 如果已连接，则切换链
      if (isConnected) {
        switchChain({ chainId: foundryChain.id });
      } else {
        // 先连接钱包，然后会自动处理
        open();
      }
    } else {
      alert('Foundry网络未配置！请确保配置中包含Foundry/Anvil网络。');
    }
  };

  // 判断当前连接的是否是wallet1
  const isWallet1Connected = isConnected && address?.toLowerCase() === wallet1Addr.toLowerCase();

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* 导航栏 - 固定高度 */}
      <div className="h-[60px] bg-gray-950/80 backdrop-blur-md border-b border-white/5">
        <NavigationBar />
      </div>
      
      {/* 主要内容区域 - 减去导航栏高度 */}
      <div className="h-[calc(100vh-60px)] p-8">
        <div className="h-full grid grid-cols-12 gap-8">
          {/* ERC20 Token Card */}
          <div className="col-span-4 h-full">
            <ERC20Card />
          </div>
          
          {/* NFT Card */}
          <div className="col-span-4 h-full">
            <NFTCard />
          </div>
          
          {/* NFT Market Card */}
          <div className="col-span-4 h-full overflow-auto custom-scrollbar">
            <NFTMarketCard />
          </div>
        </div>
      </div>
    </div>
  );
}

// 包装在Provider里面
export default function Home() {
    return (
        <AppKitProvider>
            <Demo />
        </AppKitProvider>
    );
} 