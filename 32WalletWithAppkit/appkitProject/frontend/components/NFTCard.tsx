'use client';

import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  usePublicClient
} from 'wagmi';
import { readContract } from '@wagmi/core';
import AlertModal from './AlertModal';

// 导入合约ABI
import NFTABI from '../app/contract/NFT_abi.json';

// 常量
const FOUNDRY_CHAIN_ID = 31337;
const NFTAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const NFTMarketAddr = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

// 合约配置
const nftContract = {
  address: NFTAddr as `0x${string}`,
  abi: NFTABI
};

interface NFTInfo {
  tokenId: number;
  tokenURI: string;
  approved: string;
  isApprovedForMarket: boolean;
}

export default function NFTCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [showMintSuccess, setShowMintSuccess] = useState<boolean>(false);
  const [myNFTs, setMyNFTs] = useState<NFTInfo[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [showMyNFTs, setShowMyNFTs] = useState(false);
  const [approvalInProgress, setApprovalInProgress] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 铸造NFT函数
  const { data: hash, isPending, writeContract } = useWriteContract();
  
  // 铸造等待确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ 
      hash,
    });

  // 查询NFT总数
  const { data: totalNFTs, refetch: refetchTotalNFTs } = useReadContract({
    ...nftContract,
    functionName: '_nextTokenId',
    chainId,
    query: {
      enabled: true,
    }
  });
  
  // 查询当前用户拥有的NFT数量
  const { data: ownedNFTs, refetch: refetchOwnedNFTs } = useReadContract({
    ...nftContract,
    functionName: 'balanceOf',
    args: [isConnected ? address : "0x0000000000000000000000000000000000000000"],
    chainId,
    query: {
      enabled: isConnected && !!address,
    }
  });

  // 授权NFT
  const { writeContract: approveNFT } = useWriteContract();

  // 处理授权
  const handleApprove = async (tokenId: number) => {
    if (!isConnected || !address) {
      alert('请先连接钱包');
      return;
    }

    try {
      setApprovalInProgress(tokenId);
      await approveNFT({
        ...nftContract,
        functionName: 'approve',
        args: [NFTMarketAddr, BigInt(tokenId)],
      });
      
      // 等待3秒后刷新NFT列表
      setTimeout(() => {
        scanMyNFTs();
        setApprovalInProgress(null);
      }, 3000);
    } catch (error) {
      console.error('授权失败:', error);
      alert('授权失败');
      setApprovalInProgress(null);
    }
  };

  // 扫描当前用户的NFT
  const scanMyNFTs = async () => {
    if (!isConnected || !address || !totalNFTs || !publicClient) return;
    setIsLoadingNFTs(true);
    setShowMyNFTs(true);
    
    const nfts: NFTInfo[] = [];
    for (let i = 1; i < Number(totalNFTs); i++) {
      try {
        // 查询owner
        const owner = await publicClient.readContract({
          ...nftContract,
          functionName: 'ownerOf',
          args: [BigInt(i)]
        }) as `0x${string}`;
        
        if (owner && owner.toLowerCase() === address.toLowerCase()) {
          // 查询tokenURI
          const tokenURI = await publicClient.readContract({
            ...nftContract,
            functionName: 'tokenURI',
            args: [BigInt(i)]
          }) as string;
          
          // 查询授权地址
          const approved = await publicClient.readContract({
            ...nftContract,
            functionName: 'getApproved',
            args: [BigInt(i)]
          }) as `0x${string}`;
          
          const isApprovedForMarket = approved.toLowerCase() === NFTMarketAddr.toLowerCase();
          
          if (tokenURI && approved) {
            nfts.push({
              tokenId: i,
              tokenURI,
              approved,
              isApprovedForMarket
            });
          }
        }
      } catch (e) {
        if ((e as Error).message.includes('ERC721NonexistentToken')) {
          continue;
        }
        console.error(`Error scanning NFT ${i}:`, e);
        continue;
      }
    }
    
    setMyNFTs(nfts);
    setIsLoadingNFTs(false);
  };
  
  // 铸造成功后更新数据
  useEffect(() => {
    if (isConfirmed) {
      // 显示成功提示
      setSuccessMessage('NFT铸造成功！');
      setShowSuccessModal(true);
      // 重置状态并更新数据
      refetchTotalNFTs();
      refetchOwnedNFTs();
      if (showMyNFTs) {
        scanMyNFTs(); // 只有在已经显示我的NFT列表时才刷新
      }
    }
  }, [isConfirmed, showMyNFTs]);
  
  // 处理铸造NFT
  const handleMintNFT = () => {
    if (!isConnected || !address) {
      alert('请先连接钱包');
      return;
    }
    
    try {
      writeContract({
        ...nftContract,
        functionName: 'mint',
        args: [address],
      });
    } catch (error) {
      console.error('铸造NFT失败:', error);
      alert('铸造NFT失败');
    }
  };
  
  // 修改显示的总数
  const displayTotalNFTs = totalNFTs ? Number(totalNFTs) - 1 : null;
  
  if (chainId !== FOUNDRY_CHAIN_ID) {
    return (
      <div className="token-card">
        <div className="token-info-text text-center">请切换到 Foundry 网络</div>
      </div>
    );
  }
  
  return (
    <div className="token-card">
      <h2 className="token-card-title">NFT铸造</h2>
      
      {/* NFT信息 */}
      <div className="token-inset-panel">
        <div className="token-card-text">
          <span className="token-label-text">NFT合约地址：</span>
          <span className="token-value-text">{NFTAddr}</span>
        </div>
        <div className="token-card-text mt-2">
          <span className="token-label-text">已铸造数量：</span>
          <span className="token-value-text">{displayTotalNFTs ?? '加载中...'}</span>
        </div>
        {isConnected && (
          <div className="token-card-text mt-2">
            <span className="token-label-text">我的NFT数量：</span>
            <span className="token-value-text">{ownedNFTs ? Number(ownedNFTs) : '0'}</span>
          </div>
        )}
      </div>

      {/* 铸造按钮 */}
      <div className="mt-4">
        <button
          onClick={handleMintNFT}
          disabled={!isConnected || isPending}
          className={`token-btn bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg hover:shadow-blue-500/25 w-full ${
            (!isConnected || isPending) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isPending ? '铸造中...' : '铸造NFT'}
        </button>
      </div>

      {/* 我的NFT列表 */}
      {isConnected && (
        <div className="mt-4">
          <button
            onClick={scanMyNFTs}
            className="token-btn bg-gradient-to-r from-purple-500 to-pink-400 text-white shadow-lg hover:shadow-purple-500/25 w-full"
          >
            {isLoadingNFTs ? '扫描中...' : '扫描我的NFT'}
          </button>

          {showMyNFTs && (
            <div className="mt-4 space-y-3">
              <h3 className="token-card-title text-base">我的NFT列表</h3>
              {myNFTs.length === 0 ? (
                <div className="token-info-text text-center py-2">
                  {isLoadingNFTs ? '正在加载...' : '暂无NFT'}
                </div>
              ) : (
                myNFTs.map(nft => (
                  <div key={nft.tokenId} className="token-inset-panel">
                    <div className="token-card-text">
                      <span className="token-label-text">Token ID：</span>
                      <span className="token-value-text">{nft.tokenId}</span>
                    </div>
                    <div className="token-card-text mt-1">
                      <span className="token-label-text">Token URI：</span>
                      <span className="token-value-text">{nft.tokenURI}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className={`tag ${nft.isApprovedForMarket ? 'tag-green' : 'tag-purple'}`}>
                        {nft.isApprovedForMarket ? '已授权' : '未授权'}
                      </span>
                      {!nft.isApprovedForMarket && (
                        <button
                          onClick={() => handleApprove(nft.tokenId)}
                          disabled={approvalInProgress === nft.tokenId}
                          className="token-btn bg-gradient-to-r from-purple-500 to-pink-400 text-white shadow-lg hover:shadow-purple-500/25"
                        >
                          {approvalInProgress === nft.tokenId ? '授权中...' : '授权'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* 成功提示弹窗 */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage}
      />
    </div>
  );
} 