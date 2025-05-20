import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient
} from 'wagmi';

interface NFTInfo {
  tokenId: number;
  tokenURI: string;
  approved: string;
  isApprovedForMarket: boolean;
}

interface UseNFTProps {
  contractConfig: {
    address: `0x${string}`;
    abi: any;
  };
  marketAddress: string;
}

export function useNFT({ contractConfig, marketAddress }: UseNFTProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [myNFTs, setMyNFTs] = useState<NFTInfo[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [approvalInProgress, setApprovalInProgress] = useState<number | null>(null);
  const [nftCount, setNftCount] = useState<number>(0);

  // 合约交互
  const { data: mintHash, writeContract: mint } = useWriteContract();
  const { writeContract: approveNFT } = useWriteContract();
  const { isLoading: isMintConfirming } = useWaitForTransactionReceipt({ hash: mintHash });

  // 获取NFT总数的函数
  const getNFTCount = async () => {
    if (!publicClient) return 0;
    
    // 尝试多种可能的函数名
    const possibleFunctions = ['totalSupply', '_nextTokenId', 'tokenCount', 'getTokenCount'];
    
    for (const funcName of possibleFunctions) {
      try {
        console.log(`[我的NFT] 尝试调用 ${funcName} 函数...`);
        const result = await publicClient.readContract({
          ...contractConfig,
          functionName: funcName,
          args: [] as const,
        });
        
        console.log(`[我的NFT] ${funcName} 调用成功:`, result);
        return Number(result);
      } catch (error) {
        console.log(`[我的NFT] ${funcName} 调用失败:`, (error as Error).message);
      }
    }
    
    // 如果上面的方法都失败，尝试手动检查tokenId是否存在
    console.log('[我的NFT] 尝试手动检查tokenId...');
    let maxTokenId = 0;
    let consecutiveErrors = 0;
    
    for (let i = 1; i < 100 && consecutiveErrors < 5; i++) {
      try {
        await publicClient.readContract({
          ...contractConfig,
          functionName: 'ownerOf',
          args: [BigInt(i)],
        });
        
        maxTokenId = i;
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors++;
      }
    }
    
    console.log('[我的NFT] 手动检查结果，maxTokenId:', maxTokenId);
    return maxTokenId + 1; // 加1是因为我们要返回总数而不是最大ID
  };
  
  // 初始化时获取NFT总数
  useEffect(() => {
    if (isConnected && publicClient) {
      getNFTCount().then(count => {
        console.log('[我的NFT] 获取到NFT总数:', count);
        setNftCount(count);
      });
    }
  }, [isConnected, publicClient, contractConfig]);

  // 查询当前用户拥有的NFT数量
  const { data: ownedNFTs } = useReadContract({
    ...contractConfig,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });

  // 加载NFT列表
  const loadNFTs = async () => {
    if (!isConnected || !address || !publicClient) return;
    
    setIsLoadingNFTs(true);
    try {
      // 重新获取NFT总数
      const count = await getNFTCount();
      setNftCount(count);
      
      const nfts: NFTInfo[] = [];
      console.log(`[我的NFT] 开始检查从1到${count}的NFT...`);
      
      for (let i = 1; i < count; i++) {
        try {
          const owner = await publicClient.readContract({
            ...contractConfig,
            functionName: 'ownerOf',
            args: [BigInt(i)],
          });

          const ownerAddress = owner as unknown as string;
          if (ownerAddress && ownerAddress.toLowerCase() === address.toLowerCase()) {
            const approved = await publicClient.readContract({
              ...contractConfig,
              functionName: 'getApproved',
              args: [BigInt(i)],
            });

            const approvedAddress = approved as unknown as string;
            nfts.push({
              tokenId: i,
              tokenURI: `NFT #${i}`,
              approved: approvedAddress,
              isApprovedForMarket: approvedAddress.toLowerCase() === marketAddress.toLowerCase(),
            });
          }
        } catch (error) {
          if ((error as Error).message.includes('ERC721NonexistentToken')) {
            continue;
          }
          console.error(`[我的NFT] Error checking NFT ${i}:`, error);
        }
      }
      
      console.log(`[我的NFT] 找到${nfts.length}个NFT:`, nfts);
      setMyNFTs(nfts);
    } catch (error) {
      console.error('[我的NFT] 加载NFT失败:', error);
      throw error;
    } finally {
      setIsLoadingNFTs(false);
    }
  };

  // 铸造NFT
  const handleMint = async () => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    await mint({
      ...contractConfig,
      functionName: 'mint',
      args: [address],
    });
  };

  // 授权NFT
  const handleApprove = async (tokenId: number) => {
    if (!isConnected) {
      throw new Error('请先连接钱包');
    }

    try {
      setApprovalInProgress(tokenId);
      await approveNFT({
        ...contractConfig,
        functionName: 'approve',
        args: [marketAddress as `0x${string}`, BigInt(tokenId)],
      });
    } finally {
      setApprovalInProgress(null);
    }
  };

  return {
    myNFTs,
    isLoadingNFTs,
    approvalInProgress,
    isMintConfirming,
    totalNFTs: nftCount,
    ownedNFTCount: ownedNFTs ? Number(ownedNFTs) : 0,
    loadNFTs,
    handleMint,
    handleApprove,
  };
} 