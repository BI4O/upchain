'use client';

import React, { useState } from 'react';
import { AppKitProvider } from '../../config/index';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  usePublicClient,
} from 'wagmi';
import { formatUnits } from 'viem';
import PermitBuyDebug from '../../components/debug/PermitBuyDebug';
import AuthorizationCheck from '../../components/debug/AuthorizationCheck';
import SignatureGenerator from '../../components/debug/SignatureGenerator';

const MARKET_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const SIGNER_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const ERC20_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

function TestPermitBuy() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [tokenId, setTokenId] = useState('1');
  const [logs, setLogs] = useState<string[]>([]);
  const [signature, setSignature] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  
  const { data: permitBuyHash, isPending: isPermitBuying, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: permitBuyHash });

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  // 执行permitBuy
  const executePermitBuy = async () => {
    if (!isConnected || !address) {
      addLog('❌ 请先连接钱包');
      return;
    }
    
    if (!signature) {
      addLog('❌ 请先生成或输入签名');
      return;
    }
    
    if (!publicClient) {
      addLog('❌ 网络连接错误');
      return;
    }
    
    try {
      // 检查NFT是否存在
      try {
        const seller = await publicClient.readContract({
          address: MARKET_ADDRESS as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'sellerOfNFT',
              inputs: [{ name: '_NftId', type: 'uint256' }],
              outputs: [{ name: '', type: 'address' }],
              stateMutability: 'view'
            }
          ],
          functionName: 'sellerOfNFT',
          args: [BigInt(tokenId)]
        }) as `0x${string}`;
        
        if (seller === '0x0000000000000000000000000000000000000000') {
          addLog('❌ 此NFT未上架或不存在');
          return;
        }
        
        addLog(`✅ NFT #${tokenId} 已上架，卖家: ${seller.slice(0, 6)}...${seller.slice(-4)}`);
      } catch (error) {
        addLog('❌ 检查NFT状态失败');
        return;
      }
      
      // 检查代币授权
      try {
        // 获取NFT价格
        const price = await publicClient.readContract({
          address: MARKET_ADDRESS as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'priceOfNFT',
              inputs: [{ name: '_NftId', type: 'uint256' }],
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view'
            }
          ],
          functionName: 'priceOfNFT',
          args: [BigInt(tokenId)]
        }) as bigint;
        
        // 获取代币授权额度
        const allowance = await publicClient.readContract({
          address: ERC20_ADDRESS as `0x${string}`,
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
          args: [address, MARKET_ADDRESS as `0x${string}`]
        }) as bigint;
        
        if (allowance < price) {
          addLog(`❌ 代币授权不足，需要至少 ${formatUnits(price, 18)} TK，当前授权 ${formatUnits(allowance, 18)} TK`);
          addLog('⚠️ 请先在首页的TK代币卡片中给市场合约授权足够的代币');
          return;
        }
        
        addLog('✅ 代币授权充足');
        
        // 检查余额
        const balance = await publicClient.readContract({
          address: ERC20_ADDRESS as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'balanceOf',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view'
            }
          ],
          functionName: 'balanceOf',
          args: [address]
        }) as bigint;
        
        if (balance < price) {
          addLog(`❌ 代币余额不足，需要 ${formatUnits(price, 18)} TK，当前余额 ${formatUnits(balance, 18)} TK`);
          return;
        }
        
        addLog('✅ 代币余额充足');
        addLog(`💰 NFT价格: ${formatUnits(price, 18)} TK`);
      } catch (error) {
        addLog('⚠️ 检查代币状态失败，将继续尝试购买');
      }
      
      addLog(`🚀 执行白名单购买NFT #${tokenId}`);
      
      writeContract({
        address: MARKET_ADDRESS as `0x${string}`,
        abi: [
          {
            type: 'function',
            name: 'permitBuy',
            inputs: [
              { name: '_NftId', type: 'uint256' },
              { name: 'signature', type: 'bytes' }
            ],
            outputs: [],
            stateMutability: 'nonpayable'
          }
        ],
        functionName: 'permitBuy',
        args: [BigInt(tokenId), signature as `0x${string}`],
      });
      
      addLog('⏳ 交易发送中...');
    } catch (error) {
      console.error('执行permitBuy失败:', error);
      addLog(`❌ 执行permitBuy失败: ${(error as Error).message}`);
    }
  };

  // 复制签名到剪贴板
  const copySignature = () => {
    if (signature) {
      navigator.clipboard.writeText(signature);
      setIsCopied(true);
      addLog('📋 签名已复制到剪贴板');
      
      // 3秒后重置复制状态
      setTimeout(() => {
        setIsCopied(false);
      }, 3000);
    }
  };

  // 当接收到SignatureGenerator生成的签名时
  const onSignatureGenerated = (sig: string) => {
    setSignature(sig);
    addLog(`✅ 签名已设置: ${sig.substring(0, 10)}...${sig.substring(sig.length - 10)}`);
  };

  // 检查交易结果
  React.useEffect(() => {
    if (isConfirmed) {
      addLog(`✅ 交易确认成功! 交易哈希: ${permitBuyHash}`);
    }
  }, [isConfirmed, permitBuyHash]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">NFT白名单购买系统</h1>
          <p className="text-gray-400">
            允许白名单用户通过签名验证购买NFT
          </p>
          <div className="mt-2 text-sm text-blue-400">
            当前使用的合约: <span className="font-mono">{MARKET_ADDRESS}</span>
          </div>
          <div className="text-sm text-yellow-400">
            签名者地址: <span className="font-mono">{SIGNER_ADDRESS}</span>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">白名单购买流程说明</h2>
          <div className="space-y-2 text-gray-300">
            <p>1. 管理员（地址: {SIGNER_ADDRESS}）为特定买家创建NFT购买签名</p>
            <p>2. 买家获得签名后，可以使用签名购买指定的NFT</p>
            <p>3. 每个签名只能使用一次，且只对指定的用户地址和NFT ID有效</p>
          </div>
        </div>
        
        {/* 使用SignatureGenerator组件代替内置的签名生成函数 */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">使用管理员私钥生成签名</h2>
          {/* 传递当前连接的用户地址作为默认买家地址 */}
          <div className="mb-4">
            <label className="block text-white mb-2">NFT Token ID</label>
            <input
              type="text"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* 签名生成器 */}
          <div>
            <SignatureGenerator onSignatureGenerated={onSignatureGenerated} defaultBuyerAddress={address} defaultTokenId={tokenId} />
          </div>
          
          {/* 操作面板 */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-4">执行白名单购买</h2>
            
            {signature && (
              <div className="mb-6 p-4 bg-gray-700 rounded-lg overflow-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-white font-medium">当前签名:</h3>
                  <button 
                    onClick={copySignature}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    {isCopied ? '已复制!' : '复制签名'}
                  </button>
                </div>
                <div className="text-green-400 break-all font-mono text-sm">{signature}</div>
              </div>
            )}
            
            <button
              onClick={executePermitBuy}
              disabled={!isConnected || !signature || isPermitBuying || isConfirming}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg py-3 font-medium
                        hover:shadow-green-500/25 transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPermitBuying || isConfirming ? '交易进行中...' : '执行白名单购买'}
            </button>
          </div>
        </div>
        
        {/* 执行日志 */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl mb-6">
          <h3 className="text-white font-medium mb-2">执行日志:</h3>
          <div className="p-4 bg-gray-700 rounded-lg h-[300px] overflow-auto">
            <div className="font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log.includes('❌') ? (
                    <span className="text-red-400">{log}</span>
                  ) : log.includes('✅') ? (
                    <span className="text-green-400">{log}</span>
                  ) : log.includes('⚠️') ? (
                    <span className="text-yellow-400">{log}</span>
                  ) : log.includes('⏳') ? (
                    <span className="text-blue-400">{log}</span>
                  ) : log.includes('🎉') ? (
                    <span className="text-pink-400">{log}</span>
                  ) : (
                    <span className="text-gray-300">{log}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 系统状态调试面板 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
          <div>
            <PermitBuyDebug />
          </div>
          <div>
            <AuthorizationCheck signature={signature} tokenId={tokenId} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestPermitBuyPage() {
  return (
    <AppKitProvider>
      <TestPermitBuy />
    </AppKitProvider>
  );
} 