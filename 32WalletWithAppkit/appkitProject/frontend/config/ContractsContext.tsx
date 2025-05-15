'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount, useReadContract, usePublicClient, useChainId } from 'wagmi';

// 导入合约ABI
import NFTMarketABI from '../app/contract/NFTMarket_abi.json';
import NFTABI from '../app/contract/NFT_abi.json';
import ERC20tokenABI from '../app/contract/ERC20token_abi.json';

// 常量
export const FOUNDRY_CHAIN_ID = 31337;
export const NFTAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const ERC20Addr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const marketAddr = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
export const wallet1Addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // 部署者地址

// 合约配置
export const nftContract = {
  address: NFTAddr as `0x${string}`,
  abi: NFTABI
};

export const tokenContract = {
  address: ERC20Addr as `0x${string}`,
  abi: ERC20tokenABI
};

export const marketContract = {
  address: marketAddr as `0x${string}`,
  abi: NFTMarketABI
};

// Context类型定义
type ContractsContextType = {
  isCorrectNetwork: boolean;
  totalNFTs?: bigint;
  ownedNFTs?: bigint;
  tokenBalance?: bigint;
  isOwner: boolean;
  allowance?: bigint;
  refetchNFTData: () => void;
  refetchTokenData: () => void;
};

// 创建Context
const ContractsContext = createContext<ContractsContextType | undefined>(undefined);

// Context Provider
export function ContractsProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [isOwner, setIsOwner] = useState<boolean>(false);

  // 检查网络是否正确
  const isCorrectNetwork = chainId === FOUNDRY_CHAIN_ID;

  // 查询NFT总数
  const { data: totalNFTsData, refetch: refetchTotalNFTs } = useReadContract({
    ...nftContract,
    functionName: '_nextTokenId',
    chainId,
    query: {
      enabled: isCorrectNetwork,
    }
  });
  
  // 转换为正确的类型
  const totalNFTs = totalNFTsData as bigint | undefined;
  
  // 查询当前用户拥有的NFT数量
  const { data: ownedNFTsData, refetch: refetchOwnedNFTs } = useReadContract({
    ...nftContract,
    functionName: 'balanceOf',
    args: [isConnected ? address : "0x0000000000000000000000000000000000000000"],
    chainId,
    query: {
      enabled: isCorrectNetwork && isConnected && !!address,
    }
  });
  
  // 转换为正确的类型
  const ownedNFTs = ownedNFTsData as bigint | undefined;

  // 查询代币余额
  const { data: tokenBalanceData, refetch: refetchTokenBalance } = useReadContract({
    ...tokenContract,
    functionName: 'balanceOf',
    args: [isConnected ? address : wallet1Addr],
    chainId,
    query: {
      enabled: isCorrectNetwork && (isConnected || !!wallet1Addr),
    }
  });
  
  // 转换为正确的类型
  const tokenBalance = tokenBalanceData as bigint | undefined;
  
  // 查询授权额度
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    ...tokenContract,
    functionName: 'allowance',
    args: [isConnected && address ? address : wallet1Addr, marketAddr],
    chainId,
    query: {
      enabled: isCorrectNetwork && (isConnected || !!wallet1Addr),
    }
  });
  
  // 转换为正确的类型
  const allowance = allowanceData as bigint | undefined;
  
  // 判断当前用户是否是合约拥有者
  const { data: ownerAddress, refetch: refetchOwner } = useReadContract({
    ...tokenContract,
    functionName: 'owner',
    chainId,
    query: {
      enabled: isCorrectNetwork && isConnected,
    }
  });

  // 刷新NFT数据
  const refetchNFTData = () => {
    refetchTotalNFTs();
    refetchOwnedNFTs();
  };

  // 刷新代币数据
  const refetchTokenData = () => {
    refetchTokenBalance();
    refetchOwner();
    refetchAllowance();
  };

  // 检查是否是合约拥有者
  useEffect(() => {
    if (isConnected && address && ownerAddress) {
      setIsOwner(address.toLowerCase() === (ownerAddress as string).toLowerCase());
    } else {
      setIsOwner(false);
    }
  }, [address, ownerAddress, isConnected]);

  // Context值
  const value: ContractsContextType = {
    isCorrectNetwork,
    totalNFTs,
    ownedNFTs,
    tokenBalance,
    isOwner,
    allowance,
    refetchNFTData,
    refetchTokenData
  };

  return (
    <ContractsContext.Provider value={value}>
      {children}
    </ContractsContext.Provider>
  );
}

// 自定义Hook，用于访问Context
export function useContracts() {
  const context = useContext(ContractsContext);
  if (context === undefined) {
    throw new Error('useContracts必须在ContractsProvider内部使用');
  }
  return context;
} 