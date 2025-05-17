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
import { usePermitBuy } from '../hooks/usePermitBuy';

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

// TokenAllowanceInfo组件 - 显示代币授权信息
interface TokenAllowanceInfoProps {
  address: `0x${string}`;
  marketAddress: string;
  nftPrice: string;
}

function TokenAllowanceInfo({ address, marketAddress, nftPrice }: TokenAllowanceInfoProps) {
  const publicClient = usePublicClient();
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchAllowance = async () => {
      if (!publicClient || !address) return;
      
      try {
        setIsLoading(true);
        setIsError(false);
        
        const result = await publicClient.readContract({
          address: ERC20Addr as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'allowance',
              inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' }
              ],
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view'
            }
          ],
          functionName: 'allowance',
          args: [address, marketAddress as `0x${string}`]
        }) as bigint;
        
        setAllowance(result);
      } catch (error) {
        console.error('获取授权额度失败:', error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAllowance();
    
    // 设置5秒刷新间隔
    const interval = setInterval(fetchAllowance, 5000);
    return () => clearInterval(interval);
  }, [publicClient, address, marketAddress]);

  // 判断授权是否足够
  const isAllowanceSufficient = (): boolean => {
    if (!allowance || !nftPrice) return false;
    return allowance >= BigInt(nftPrice);
  };

  if (isLoading) {
    return <div className="text-gray-400">正在加载授权信息...</div>;
  }

  if (isError) {
    return <div className="text-red-400">获取授权信息失败</div>;
  }

  const formattedAllowance = allowance ? formatUnits(allowance, 18) : '0';
  const formattedPrice = nftPrice ? formatUnits(BigInt(nftPrice), 18) : '0';
  const sufficient = isAllowanceSufficient();

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-gray-300">代币授权额度:</span>
        <span className={sufficient ? "text-green-400" : "text-yellow-400"}>
          {formattedAllowance} TK
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-300">NFT 价格:</span>
        <span className="text-blue-400">{formattedPrice} TK</span>
      </div>
      {!sufficient && (
        <div className="mt-1 text-yellow-400 text-xs">
          ⚠️ 授权不足，请先在TK代币卡片中授权足够的代币
        </div>
      )}
      {sufficient && (
        <div className="mt-1 text-green-400 text-xs">
          ✅ 授权充足，可以进行购买
        </div>
      )}
    </div>
  );
}

export default function NFTMarketCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { createSignature, isSignatureUsed } = usePermitBuy();
  
  const [nftList, setNftList] = useState<NFTMarketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listTokenId, setListTokenId] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [buyTokenId, setBuyTokenId] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [signingMessage, setSigningMessage] = useState('');
  const [manualSignature, setManualSignature] = useState('');
  const [showSignatureInput, setShowSignatureInput] = useState(false);
  const [activeNft, setActiveNft] = useState<NFTMarketItem | null>(null);

  // 上架NFT
  const { data: listHash, isPending: isListing, writeContract: writeList } = useWriteContract();
  const { isLoading: isListConfirming, isSuccess: isListConfirmed } = useWaitForTransactionReceipt({ hash: listHash });

  // 购买NFT
  const { data: buyHash, isPending: isBuying, writeContract: writeBuy } = useWriteContract();
  const { isLoading: isBuyConfirming, isSuccess: isBuyConfirmed } = useWaitForTransactionReceipt({ hash: buyHash });

  // 白名单购买NFT
  const { data: permitBuyHash, isPending: isPermitBuying, writeContract: writePermitBuy } = useWriteContract();
  const { isLoading: isPermitBuyConfirming, isSuccess: isPermitBuyConfirmed } = useWaitForTransactionReceipt({ hash: permitBuyHash });

  // 查询用户TK代币余额
  const { data: userTokenBalance, refetch: refetchTokenBalance } = useReadContract({
    ...erc20Contract,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    chainId,
    query: { 
      enabled: isConnected && !!address && chainId === FOUNDRY_CHAIN_ID,
      refetchInterval: 3000, // 每3秒自动刷新
    },
  });

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
  }, [totalNFTs, chainId, isListConfirmed, isBuyConfirmed, isPermitBuyConfirmed, address, publicClient]);

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
    if (isBuyConfirmed || isPermitBuyConfirmed) {
      setSuccessMessage('NFT购买成功！');
      setShowSuccessModal(true);
      setSigningMessage('');
      // 刷新代币余额
      refetchTokenBalance();
    }
  }, [isBuyConfirmed, isPermitBuyConfirmed, refetchTokenBalance]);

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

  // 白名单购买NFT
  const handlePermitBuy = async (tokenId: number, price: string) => {
    if (!isConnected || !address) return alert('请先连接钱包');
    if (!publicClient) return alert('网络连接错误');

    // 设置当前处理的NFT，用于显示签名输入框
    const nft = nftList.find(nft => nft.tokenId === tokenId);
    if (nft) {
      setActiveNft(nft);
      setShowSignatureInput(true);
      return;
    }
  };

  // 使用已有签名执行白名单购买
  const executePermitBuyWithSignature = async () => {
    if (!activeNft || !manualSignature) return;
    if (!publicClient) {
      alert('网络连接错误');
      return;
    }
    
    try {
      setSigningMessage('正在处理白名单购买...');
      
      // 检查用户是否有足够的代币授权
      if (address) {
        const allowance = await publicClient.readContract({
          ...erc20Contract,
          functionName: 'allowance',
          args: [address, marketAddr as `0x${string}`]
        }) as bigint;
        
        const price = BigInt(activeNft.price);
        
        if (allowance < price) {
          setSigningMessage('');
          alert(`授权不足！需要授权至少 ${formatUnits(price, 18)} TK，当前授权 ${formatUnits(allowance, 18)} TK`);
          return;
        }
        
        // 检查余额是否足够
        const balance = await publicClient.readContract({
          ...erc20Contract,
          functionName: 'balanceOf',
          args: [address]
        }) as bigint;
        
        if (balance < price) {
          setSigningMessage('');
          alert(`余额不足！需要 ${formatUnits(price, 18)} TK，当前余额 ${formatUnits(balance, 18)} TK`);
          return;
        }
      }
      
      // 检查签名是否已使用
      try {
        const isUsed = await publicClient.readContract({
          address: marketAddr as `0x${string}`,
          abi: NFTMarketABI,
          functionName: 'usedSignatures',
          args: [manualSignature as `0x${string}`]
        }) as boolean;
        
        if (isUsed) {
          setSigningMessage('');
          alert('此签名已被使用，无法继续购买');
          return;
        }
      } catch (error) {
        console.warn('检查签名状态失败:', error);
        // 继续执行，让合约处理
      }
      
      // 执行permitBuy购买
      writePermitBuy({
        ...marketContract,
        functionName: 'permitBuy',
        args: [BigInt(activeNft.tokenId), manualSignature as `0x${string}`],
      });
      
      // 清理状态
      setShowSignatureInput(false);
    } catch (e) {
      console.error('白名单购买失败:', e);
      setSigningMessage('');
      alert(`白名单购买失败: ${(e as Error).message}`);
    }
  };

  // 使用钱包自动创建签名并购买
  const createAndUseSignature = async () => {
    if (!activeNft || !address) return;
    if (!publicClient) {
      alert('网络连接错误');
      return;
    }
    
    setShowSignatureInput(false);
    setSigningMessage('正在创建白名单购买签名...');

    try {
      // 检查用户是否有足够的代币授权
      const allowance = await publicClient.readContract({
        ...erc20Contract,
        functionName: 'allowance',
        args: [address, marketAddr as `0x${string}`]
      }) as bigint;
      
      const price = BigInt(activeNft.price);
      
      if (allowance < price) {
        setSigningMessage('');
        alert(`授权不足！需要授权至少 ${formatUnits(price, 18)} TK，当前授权 ${formatUnits(allowance, 18)} TK`);
        return;
      }
      
      // 检查余额是否足够
      const balance = await publicClient.readContract({
        ...erc20Contract,
        functionName: 'balanceOf',
        args: [address]
      }) as bigint;
      
      if (balance < price) {
        setSigningMessage('');
        alert(`余额不足！需要 ${formatUnits(price, 18)} TK，当前余额 ${formatUnits(balance, 18)} TK`);
        return;
      }

      // 为当前用户创建白名单签名
      const signature = await createSignature(address, BigInt(activeNft.tokenId));
      if (!signature) {
        setSigningMessage('');
        alert('创建签名失败');
        return;
      }

      // 检查签名是否已被使用
      const isUsed = await isSignatureUsed(marketAddr as `0x${string}`, signature as `0x${string}`);
      if (isUsed) {
        setSigningMessage('');
        alert('此签名已被使用，无法继续购买');
        return;
      }

      setSigningMessage('签名创建成功，正在处理购买...');

      // 执行permitBuy购买
      writePermitBuy({
        ...marketContract,
        functionName: 'permitBuy',
        args: [BigInt(activeNft.tokenId), signature],
      });
    } catch (e) {
      console.error('白名单购买失败:', e);
      setSigningMessage('');
      alert(`白名单购买失败: ${(e as Error).message}`);
    }
  };

  // 取消签名输入
  const cancelSignatureInput = () => {
    setShowSignatureInput(false);
    setManualSignature('');
    setActiveNft(null);
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

      {/* 正在签名提示 */}
      {signingMessage && (
        <div className="mt-4 p-3 bg-gray-700 rounded-lg text-center">
          <div className="animate-pulse text-blue-400">{signingMessage}</div>
        </div>
      )}

      {/* 签名输入弹窗 */}
      {showSignatureInput && activeNft && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl text-white font-medium mb-4">白名单购买 NFT #{activeNft.tokenId}</h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-gray-300 mb-2">请选择购买方式：</p>
                <div className="space-y-3">
                  <button
                    onClick={createAndUseSignature}
                    className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 
                              text-white font-medium hover:shadow-blue-500/25 transition-all"
                  >
                    自动创建并使用签名
                  </button>
                  
                  {/* 显示代币授权信息 */}
                  {address && (
                    <div className="p-3 bg-gray-700 rounded-lg text-sm">
                      <h4 className="text-white font-medium mb-1">当前授权状态:</h4>
                      <TokenAllowanceInfo
                        address={address}
                        marketAddress={marketAddr}
                        nftPrice={activeNft.price}
                      />
                    </div>
                  )}
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-2 bg-gray-800 text-gray-400 text-sm">或者</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-gray-300 mb-2">
                      粘贴从白名单测试页面获取的签名:
                    </label>
                    <textarea
                      value={manualSignature}
                      onChange={(e) => setManualSignature(e.target.value)}
                      className="w-full bg-gray-700 text-white rounded-lg p-3 min-h-[80px]
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="粘贴0x开头的签名..."
                    />
                    
                    <button
                      onClick={executePermitBuyWithSignature}
                      disabled={!manualSignature}
                      className={`w-full mt-3 py-2 px-4 rounded-lg bg-gradient-to-r 
                                from-green-500 to-teal-500 text-white font-medium 
                                hover:shadow-green-500/25 transition-all
                                ${!manualSignature ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      使用签名购买
                    </button>
                  </div>
                </div>
              </div>
              
              <button
                onClick={cancelSignatureInput}
                className="w-full py-2 px-4 rounded-lg bg-gray-700 text-gray-300 
                          hover:bg-gray-600 transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

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

                  <div className="pt-2 grid grid-cols-2 gap-2">
                    {/* 普通购买按钮 */}
                    <button
                      onClick={() => handleBuy(nft.tokenId, nft.price)}
                      disabled={isBuying || isPermitBuying || nft.seller.toLowerCase() === address?.toLowerCase()}
                      className="w-full px-3 py-2 rounded-lg font-medium
                               bg-gradient-to-r from-purple-500 to-pink-400 
                               text-white shadow-lg 
                               hover:shadow-purple-500/25 hover:scale-[1.02]
                               transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed
                               disabled:hover:scale-100"
                    >
                      {isBuying ? '购买中...' : 
                       nft.seller.toLowerCase() === address?.toLowerCase() ? 
                       '这是你的NFT' : '普通购买'}
                    </button>

                    {/* 白名单购买按钮 */}
                    <button
                      onClick={() => handlePermitBuy(nft.tokenId, nft.price)}
                      disabled={isPermitBuying || isBuying || nft.seller.toLowerCase() === address?.toLowerCase()}
                      className="w-full px-3 py-2 rounded-lg font-medium
                               bg-gradient-to-r from-green-500 to-teal-400 
                               text-white shadow-lg 
                               hover:shadow-green-500/25 hover:scale-[1.02]
                               transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed
                               disabled:hover:scale-100"
                    >
                      {isPermitBuying ? '购买中...' : 
                       nft.seller.toLowerCase() === address?.toLowerCase() ? 
                       '这是你的NFT' : '白名单购买'}
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