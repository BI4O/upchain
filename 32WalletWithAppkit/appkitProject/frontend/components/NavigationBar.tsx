'use client';

import { useState } from 'react';
import { 
  useAccount, 
  useDisconnect, 
  useChainId, 
  useChains,
  useBalance, 
  useSwitchChain 
} from 'wagmi';
import { useAppKit } from '@reown/appkit/react';

// foundry网络ID
const FOUNDRY_CHAIN_ID = 31337;

export default function NavigationBar() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const chains = useChains();
  const { switchChain } = useSwitchChain();
  
  // 找到foundry网络
  const foundryChain = chains.find(chain => chain.name === 'Foundry' || chain.id === FOUNDRY_CHAIN_ID);
  const currentChain = chains.find(chain => chain.id === chainId);
  
  // 查余额
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: isConnected ? address : undefined,
    chainId: chainId
  });
  
  return (
    <nav className="w-full h-full">
      <div className="h-full px-8 mx-auto flex justify-between items-center">
        {/* 左侧标题 */}
        <div className="text-xl font-bold text-white">
          Appkit Demo
        </div>
        
        {/* 右侧内容 */}
        <div className="flex items-center gap-6">
          {isConnected ? (
            <>
              {/* 网络状态 */}
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  chainId === FOUNDRY_CHAIN_ID ? 'bg-green-400' : 'bg-yellow-400'
                }`}></div>
                <span className="text-sm text-gray-300">
                  {currentChain?.name || '未知网络'}
                </span>
              </div>
              
              {/* 余额显示 */}
              <div className="text-sm text-gray-300">
                {isBalanceLoading ? (
                  <span>加载中...</span>
                ) : (
                  <span>{balance?.formatted.substring(0, 6)} {balance?.symbol}</span>
                )}
              </div>
              
              {/* 地址显示 */}
              <div className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
              
              {/* 切换网络按钮 */}
              {foundryChain && chainId !== FOUNDRY_CHAIN_ID && (
                <button 
                  onClick={() => switchChain({ chainId: foundryChain.id })}
                  className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 
                           hover:bg-green-500/30 transition-colors text-sm"
                >
                  切换到Foundry
                </button>
              )}
              
              {/* 断开连接按钮 */}
              <button 
                onClick={() => disconnect()}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 
                         hover:bg-red-500/30 transition-colors text-sm"
              >
                断开连接
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => open()}
                className="px-4 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 
                         hover:bg-blue-500/30 transition-colors text-sm"
              >
                连接钱包
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 