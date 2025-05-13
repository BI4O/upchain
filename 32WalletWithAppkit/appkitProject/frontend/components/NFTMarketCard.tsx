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
import NFTMarketABI from '../app/contract/NFTMarket_abi.json';
import NFTABI from '../app/contract/NFT_abi.json';
import ERC20ABI from '../app/contract/ERC20token_abi.json';
import { encodeFunctionData, decodeFunctionResult, formatUnits } from 'viem';
import AlertModal from './AlertModal';

const FOUNDRY_CHAIN_ID = 31337;
const marketAddr = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const NFTAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ERC20Addr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const marketContract = {
  address: marketAddr as `0x${string}`,
  abi: NFTMarketABI
};
const nftContract = {
  address: NFTAddr as `0x${string}`,
  abi: NFTABI
};
const erc20Contract = {
  address: ERC20Addr as `0x${string}`,
  abi: ERC20ABI
};

interface NFTMarketItem {
  tokenId: number;
  price: string;
  seller: string;
}

export default function NFTMarketCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [nftList, setNftList] = useState<NFTMarketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listTokenId, setListTokenId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [buyTokenId, setBuyTokenId] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // 上架NFT
  const { data: listHash, isPending: isListing, writeContract: writeList } = useWriteContract();
  const { isLoading: isListConfirming, isSuccess: isListConfirmed } = useWaitForTransactionReceipt({ hash: listHash });

  // 购买NFT
  const { data: buyHash, isPending: isBuying, writeContract: writeBuy } = useWriteContract();
  const { isLoading: isBuyConfirming, isSuccess: isBuyConfirmed } = useWaitForTransactionReceipt({ hash: buyHash });

  // 查询NFT总数
  const { data: totalNFTs } = useReadContract({
    ...nftContract,
    functionName: '_nextTokenId',
    chainId,
    query: { enabled: chainId === FOUNDRY_CHAIN_ID },
  });

  // 查询所有NFT的上架信息
  useEffect(() => {
    const fetchMarket = async () => {
      if (!totalNFTs || chainId !== FOUNDRY_CHAIN_ID || !publicClient || !address) return;
      setLoading(true);
      const nfts: NFTMarketItem[] = [];
      // 从1开始扫描，因为0不是有效的tokenId
      for (let i = 1; i < Number(totalNFTs); i++) {
        try {
          // 价格
          const price = await publicClient.readContract({
            ...marketContract,
            functionName: 'priceOfNFT',
            args: [BigInt(i)]
          }) as bigint;

          // 卖家
          const seller = await publicClient.readContract({
            ...marketContract,
            functionName: 'sellerOfNFT',
            args: [BigInt(i)]
          }) as `0x${string}`;

          // 只显示已上架（价格大于0且卖家非0地址）
          if (price && seller && seller !== '0x0000000000000000000000000000000000000000' && price > BigInt(0)) {
            nfts.push({ 
              tokenId: i, 
              price: price.toString(), 
              seller
            });
          }
        } catch (e) {
          // 忽略未上架的NFT
          continue;
        }
      }
      setNftList(nfts);
      setLoading(false);
    };
    fetchMarket();
  }, [totalNFTs, chainId, isListConfirmed, isBuyConfirmed, address, publicClient]);

  // 监听上架结果
  useEffect(() => {
    if (isListConfirmed) {
      setSuccessMessage('NFT上架成功！');
      setShowSuccessModal(true);
      setListTokenId('');
      setListPrice('');
    }
  }, [isListConfirmed]);

  // 监听购买结果
  useEffect(() => {
    if (isBuyConfirmed) {
      setSuccessMessage('NFT购买成功！');
      setShowSuccessModal(true);
    }
  }, [isBuyConfirmed]);

  // 上架NFT
  const handleList = async () => {
    if (!isConnected || !address) return alert('请先连接钱包');
    if (!listTokenId || !listPrice) return alert('请输入tokenId和价格');
    if (!publicClient) return alert('网络连接错误');
    
    try {
      // 检查NFT所有权
      const owner = await publicClient.readContract({
        ...nftContract,
        functionName: 'ownerOf',
        args: [BigInt(listTokenId)]
      }) as `0x${string}`;
      
      if (owner.toLowerCase() !== address.toLowerCase()) {
        alert('您不是此NFT的所有者');
        return;
      }
      
      // 检查授权状态
      const approved = await publicClient.readContract({
        ...nftContract,
        functionName: 'getApproved',
        args: [BigInt(listTokenId)]
      }) as `0x${string}`;
      
      if (approved.toLowerCase() !== marketAddr.toLowerCase()) {
        alert('请先在NFT卡片中授权给市场合约');
        return;
      }

      // 执行上架
      writeList({
        ...marketContract,
        functionName: 'list',
        args: [BigInt(listTokenId), BigInt(listPrice)],
      });
    } catch (e) {
      console.error('上架失败:', e);
      if ((e as Error).message.includes('ERC721NonexistentToken')) {
        alert('此NFT不存在');
      } else {
        alert('上架失败');
      }
    }
  };

  // 购买NFT
  const handleBuy = async (tokenId: number, price: string) => {
    if (!isConnected || !address) return alert('请先连接钱包');
    if (!publicClient) return alert('网络连接错误');

    try {
      writeBuy({
        ...marketContract,
        functionName: 'buyNFT',
        args: [BigInt(tokenId)],
      });
    } catch (e) {
      console.error('购买失败:', e);
      alert('购买失败');
    }
  };

  if (chainId !== FOUNDRY_CHAIN_ID) {
    return (
      <div className="market-card">
        <div className="market-info-text text-center">请切换到 Foundry 网络</div>
      </div>
    );
  }

  return (
    <div className="market-card">
      <h2 className="market-card-title">NFT市场</h2>
      
      {/* 上架NFT */}
      <div className="market-inset-panel">
        <h3 className="market-label-text mb-4">上架NFT</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="market-label-text">Token ID</label>
            <input
              type="text"
              className="market-input"
              value={listTokenId}
              onChange={(e) => setListTokenId(e.target.value)}
              placeholder="输入要上架的NFT ID"
            />
          </div>
          <div>
            <label className="market-label-text">价格 (TK)</label>
            <input
              type="text"
              className="market-input"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="输入上架价格"
            />
          </div>
        </div>
        <button
          onClick={handleList}
          disabled={!isConnected || isListing}
          className={`market-btn bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg hover:shadow-blue-500/25 w-full mt-4 ${
            (!isConnected || isListing) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isListing ? '上架中...' : '上架NFT'}
        </button>
      </div>

      {/* NFT列表 */}
      <div className="mt-6">
        <h3 className="market-card-title">市场列表</h3>
        {loading ? (
          <div className="market-info-text text-center py-4">加载中...</div>
        ) : nftList.length > 0 ? (
          <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            {nftList.map((nft) => (
              <div key={nft.tokenId} className="market-inset-panel mb-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-white">NFT #{nft.tokenId}</span>
                    <span className="text-lg font-medium text-blue-400">
                      {formatUnits(BigInt(nft.price), 18)} TK
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    卖家：{nft.seller.slice(0, 6)}...{nft.seller.slice(-4)}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handleBuy(nft.tokenId, nft.price)}
                      disabled={isBuying || nft.seller.toLowerCase() === address?.toLowerCase()}
                      className="w-full px-4 py-2 rounded-lg font-medium
                               bg-gradient-to-r from-purple-500 to-pink-400 
                               text-white shadow-lg 
                               hover:shadow-purple-500/25 hover:scale-[1.02]
                               transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed
                               disabled:hover:scale-100"
                    >
                      {isBuying ? '购买中...' : 
                       nft.seller.toLowerCase() === address?.toLowerCase() ? 
                       '这是你的NFT' : '购买 NFT'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="market-info-text text-center py-4">暂无上架的NFT</div>
        )}
      </div>

      {/* 成功提示弹窗 */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage}
      />
    </div>
  );
} 