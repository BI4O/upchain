'use client';

import React, { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { keccak256, concat, toBytes, numberToHex } from 'viem';

// 合约地址
const MARKET_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const ERC20_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const SIGNER_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

interface AuthorizationCheckProps {
  signature?: string;
  tokenId?: string;
}

export function AuthorizationCheck({ signature, tokenId }: AuthorizationCheckProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const checkAuthorization = async () => {
    if (!isConnected || !address || !publicClient) {
      addLog('❌ 请先连接钱包');
      return;
    }

    setChecking(true);
    addLog('🔍 开始检查授权状态...');

    try {
      // 检查合约地址
      addLog(`📋 市场合约地址: ${MARKET_ADDRESS}`);
      addLog(`📋 代币合约地址: ${ERC20_ADDRESS}`);
      
      // 检查用户余额
      try {
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
        
        addLog(`💰 当前用户余额: ${balance.toString()} wei`);
      } catch (error) {
        addLog(`❌ 获取余额失败: ${(error as Error).message}`);
      }
      
      // 检查用户授权
      try {
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
        
        addLog(`🔐 授权给市场合约: ${allowance.toString()} wei`);
        
        if (allowance > BigInt(0)) {
          addLog('✅ 已授权代币给市场合约');
        } else {
          addLog('⚠️ 未授权代币给市场合约，请在TK代币卡片中进行授权');
        }
      } catch (error) {
        addLog(`❌ 获取授权失败: ${(error as Error).message}`);
      }
      
      // 验证签名(如果提供了签名和tokenId)
      if (signature && tokenId) {
        try {
          addLog(`🔍 验证签名: ${signature.substring(0, 10)}...${signature.substring(signature.length - 10)}`);
          addLog(`🔍 验证NFT ID: ${tokenId}`);
          
          // 检查签名是否已使用
          try {
            const isUsed = await publicClient.readContract({
              address: MARKET_ADDRESS as `0x${string}`,
              abi: [
                {
                  type: 'function',
                  name: 'usedSignatures',
                  inputs: [{ name: '', type: 'bytes' }],
                  outputs: [{ name: '', type: 'bool' }],
                  stateMutability: 'view'
                }
              ],
              functionName: 'usedSignatures',
              args: [signature as `0x${string}`]
            }) as boolean;
            
            if (isUsed) {
              addLog('❌ 此签名已被使用，无法继续购买');
            } else {
              addLog('✅ 签名未被使用');
            }
          } catch (error) {
            addLog(`⚠️ 检查签名使用状态失败: ${(error as Error).message}`);
          }
          
          // 重现签名验证过程
          // 按照合约逻辑拼接消息 (abi.encodePacked(buyer, tokenId))
          const encodedTokenId = numberToHex(BigInt(tokenId), { size: 32 });
          const packedMessage = concat([address, encodedTokenId]);
          
          // 计算消息哈希
          const messageHash = keccak256(packedMessage);
          addLog(`📋 消息哈希: ${messageHash}`);
          
          // 由于前端验证签名恢复比较复杂，我们提醒用户在生成签名后使用合约方法验证
          addLog(`⚠️ 签名已生成，请直接使用此签名调用合约的permitBuy函数`);
          addLog(`📋 签名用于买家: ${address}`);
          addLog(`📋 NFT ID: ${tokenId}`);
          addLog(`📋 预期签名者: ${SIGNER_ADDRESS}`);
          
          // 查询NFT价格信息
          try {
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
            
            addLog(`💰 NFT价格: ${price.toString()} wei`);
          } catch (error) {
            addLog(`⚠️ 获取NFT价格失败: ${(error as Error).message}`);
          }
        } catch (error) {
          addLog(`❌ 签名验证过程出错: ${(error as Error).message}`);
        }
      }
      
      addLog('✅ 检查完成');
    } catch (error) {
      addLog(`❌ 检查失败: ${(error as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <h2 className="text-xl font-bold text-white mb-4">授权与签名检查工具</h2>
      
      <button
        onClick={checkAuthorization}
        disabled={checking || !isConnected}
        className={`w-full py-3 px-4 rounded-lg font-medium mb-4
                   bg-gradient-to-r from-blue-500 to-indigo-600 text-white
                   hover:shadow-blue-500/25 transition-all
                   ${(checking || !isConnected) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {checking ? '检查中...' : signature ? '检查授权与签名' : '检查授权状态'}
      </button>
      
      <div className="bg-gray-700 p-3 rounded-lg h-[300px] overflow-auto">
        <h3 className="text-white font-medium mb-2">检查日志:</h3>
        <div className="font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-400">点击上方按钮开始检查</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log.includes('❌') ? (
                  <span className="text-red-400">{log}</span>
                ) : log.includes('✅') ? (
                  <span className="text-green-400">{log}</span>
                ) : log.includes('⚠️') ? (
                  <span className="text-yellow-400">{log}</span>
                ) : log.includes('🔍') || log.includes('⏳') ? (
                  <span className="text-blue-400">{log}</span>
                ) : log.includes('💰') ? (
                  <span className="text-pink-400">{log}</span>
                ) : log.includes('🔐') ? (
                  <span className="text-purple-400">{log}</span>
                ) : (
                  <span className="text-gray-300">{log}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthorizationCheck; 