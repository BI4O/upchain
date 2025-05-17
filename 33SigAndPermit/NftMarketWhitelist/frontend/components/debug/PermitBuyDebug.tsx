'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';

// 合约地址
const MARKET_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const NFT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ERC20_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const SIGNER_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

export function PermitBuyDebug() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [nftOwners, setNftOwners] = useState<Record<string, string>>({});
  const [nftPrices, setNftPrices] = useState<Record<string, string>>({});
  const [signerBalance, setSignerBalance] = useState<string>('0');
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [tokenAllowances, setTokenAllowances] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (!publicClient || !isConnected) return;
    
    // 获取签名者账户余额
    const fetchSignerBalance = async () => {
      try {
        const balance = await publicClient.getBalance({
          address: SIGNER_ADDRESS as `0x${string}`
        });
        setSignerBalance(formatUnits(balance, 18));
      } catch (error) {
        console.error('获取签名者余额失败:', error);
      }
    };
    
    // 获取TK代币余额
    const fetchTokenBalances = async () => {
      const balances: Record<string, string> = {};
      
      try {
        // 当前用户余额
        if (address) {
          const userBalance = await publicClient.readContract({
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
          
          balances['user'] = formatUnits(userBalance, 18);
        }
        
        // 签名者余额
        const signerTokenBalance = await publicClient.readContract({
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
          args: [SIGNER_ADDRESS as `0x${string}`]
        }) as bigint;
        
        balances['signer'] = formatUnits(signerTokenBalance, 18);
        
        setTokenBalances(balances);
      } catch (error) {
        console.error('获取代币余额失败:', error);
      }
    };
    
    // 获取代币授权情况
    const fetchTokenAllowances = async () => {
      const allowances: Record<string, string> = {};
      
      try {
        // 当前用户对市场合约的授权
        if (address) {
          const userAllowance = await publicClient.readContract({
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
          
          allowances['user'] = formatUnits(userAllowance, 18);
        }
        
        setTokenAllowances(allowances);
      } catch (error) {
        console.error('获取代币授权失败:', error);
      }
    };
    
    // 获取NFT 1-5的所有权
    const fetchNftOwners = async () => {
      const owners: Record<string, string> = {};
      for (let i = 1; i <= 5; i++) {
        try {
          const owner = await publicClient.readContract({
            address: NFT_ADDRESS as `0x${string}`,
            abi: [
              {
                type: 'function',
                name: 'ownerOf',
                inputs: [{ name: 'tokenId', type: 'uint256' }],
                outputs: [{ name: '', type: 'address' }],
                stateMutability: 'view'
              }
            ],
            functionName: 'ownerOf',
            args: [BigInt(i)]
          }) as `0x${string}`;
          
          owners[i.toString()] = owner;
        } catch (e) {
          owners[i.toString()] = '未铸造或不存在';
        }
      }
      setNftOwners(owners);
    };
    
    // 获取NFT 1-5的价格
    const fetchNftPrices = async () => {
      const prices: Record<string, string> = {};
      for (let i = 1; i <= 5; i++) {
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
            args: [BigInt(i)]
          }) as bigint;
          
          prices[i.toString()] = formatUnits(price, 18);
        } catch (e) {
          prices[i.toString()] = '未上架';
        }
      }
      setNftPrices(prices);
    };
    
    fetchSignerBalance();
    fetchTokenBalances();
    fetchTokenAllowances();
    fetchNftOwners();
    fetchNftPrices();
    
    // 每5秒刷新一次数据
    const interval = setInterval(() => {
      fetchSignerBalance();
      fetchTokenBalances();
      fetchTokenAllowances();
      fetchNftOwners();
      fetchNftPrices();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [publicClient, isConnected, address]);
  
  // 展示是否是当前连接的用户地址
  const formatAddress = (addr: string) => {
    if (!addr || addr === '未铸造或不存在' || addr === '未上架') return addr;
    
    const isCurrentUser = address && addr.toLowerCase() === address.toLowerCase();
    const isSigner = addr.toLowerCase() === SIGNER_ADDRESS.toLowerCase();
    
    const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    
    if (isCurrentUser) {
      return <span className="text-green-400 font-medium">{shortAddr} (你)</span>;
    } else if (isSigner) {
      return <span className="text-yellow-400 font-medium">{shortAddr} (签名者)</span>;
    } else {
      return shortAddr;
    }
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <h2 className="text-xl font-bold text-white mb-4">白名单购买系统状态</h2>
      
      <div className="space-y-4">
        <div className="bg-gray-700 p-3 rounded-lg">
          <h3 className="text-lg text-white mb-2">签名者信息</h3>
          <p className="text-gray-300">
            地址: <span className="text-yellow-400">{SIGNER_ADDRESS}</span>
          </p>
          <p className="text-gray-300">
            余额: <span className="text-blue-400">{parseFloat(signerBalance).toFixed(4)} ETH</span>
          </p>
          <p className="text-gray-300">
            TK代币: <span className="text-green-400">{tokenBalances['signer'] ? parseFloat(tokenBalances['signer']).toFixed(2) : '0'} TK</span>
          </p>
          <p className="text-gray-400 text-sm mt-1">
            (在实际项目中，签名者应该是管理员账户，它为白名单用户生成有效的签名)
          </p>
        </div>
        
        {address && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <h3 className="text-lg text-white mb-2">当前用户信息</h3>
            <p className="text-gray-300">
              地址: <span className="text-green-400">{address}</span>
            </p>
            <p className="text-gray-300">
              TK代币余额: <span className="text-green-400">{tokenBalances['user'] ? parseFloat(tokenBalances['user']).toFixed(2) : '0'} TK</span>
            </p>
            <p className="text-gray-300">
              授权给市场合约: <span className="text-blue-400">{tokenAllowances['user'] ? parseFloat(tokenAllowances['user']).toFixed(2) : '0'} TK</span>
              {tokenAllowances['user'] && parseFloat(tokenAllowances['user']) > 0 && (
                <span className="ml-2 text-xs text-green-400">(已授权)</span>
              )}
            </p>
          </div>
        )}
        
        <div className="bg-gray-700 p-3 rounded-lg">
          <h3 className="text-lg text-white mb-2">NFT 所有权和价格</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-2 px-3 text-gray-400">Token ID</th>
                  <th className="text-left py-2 px-3 text-gray-400">所有者</th>
                  <th className="text-left py-2 px-3 text-gray-400">市场价格</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(nftOwners).map((tokenId) => (
                  <tr key={tokenId} className="border-b border-gray-600">
                    <td className="py-2 px-3 text-white">#{tokenId}</td>
                    <td className="py-2 px-3 text-white">{formatAddress(nftOwners[tokenId])}</td>
                    <td className="py-2 px-3 text-white">
                      {nftPrices[tokenId] === '未上架' ? 
                        <span className="text-gray-500">未上架</span> : 
                        <span className="text-blue-400">{parseFloat(nftPrices[tokenId]).toFixed(2)} TK</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-gray-700 p-3 rounded-lg">
          <h3 className="text-lg text-white mb-2">系统说明</h3>
          <ul className="text-gray-300 list-disc pl-5 space-y-1">
            <li>白名单购买流程：管理员为特定用户生成对特定NFT的购买签名</li>
            <li>用户用签名调用 permitBuy 函数完成购买，无需满足其他条件</li>
            <li>每个签名只能使用一次，之后会被系统标记为已使用</li>
            <li>当前用户可以在白名单测试页面生成测试签名</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default PermitBuyDebug; 