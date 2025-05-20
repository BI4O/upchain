'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, formatEther, getContract, custom } from 'viem';
import { foundry } from 'viem/chains';
import Counter_ABI from './contracts/Counter.json';

// Counter 合约地址
const COUNTER_ADDRESS = "0x7148E9A2d539A99a66f1bd591E4E20cA35a08eD5";

export default function Home() {
  const [balance, setBalance] = useState<string>('0');
  const [counterNumber, setCounterNumber] = useState<string>('0');
  const [address, setAddress] = useState<`0x${string}` | undefined>();
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | undefined>();

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(),
  });

  // 连接钱包
  const connectWallet = async () => {
    if (typeof window === 'undefined') {
      alert('请在浏览器环境中运行');
      return;
    }

    if (typeof window.ethereum === 'undefined') {
      alert('请安装 MetaMask 浏览器扩展');
      return;
    }

    try {
      console.log('开始连接钱包...');
      console.log('MetaMask 状态:', (window.ethereum as any).isMetaMask ? '已安装' : '未安装');
      
      // 检查是否已经连接
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      console.log('当前账户:', accounts);
      
      if (accounts.length > 0) {
        setAddress(accounts[0] as `0x${string}`);
        setIsConnected(true);
        return;
      }

      console.log('请求连接钱包...');
      // 请求连接
      const [address] = await window.ethereum.request({ 
        method: 'eth_requestAccounts',
        params: []
      }).catch((error: any) => {
        console.error('请求账户失败:', error);
        throw error;
      });
      
      console.log('获取链 ID...');
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        .catch((error: any) => {
          console.error('获取链 ID 失败:', error);
          throw error;
        });
      
      console.log('连接成功:', { address, chainId });
      setAddress(address as `0x${string}`);
      setChainId(Number(chainId));
      setIsConnected(true);

      // 监听账户变化
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        console.log('账户变化:', accounts);
        if (accounts.length === 0) {
          setIsConnected(false);
          setAddress(undefined);
        } else {
          setAddress(accounts[0] as `0x${string}`);
        }
      });

      // 监听网络变化
      window.ethereum.on('chainChanged', (chainId: string) => {
        console.log('网络变化:', chainId);
        setChainId(Number(chainId));
      });
    } catch (error: any) {
      console.error('连接钱包失败:', error);
      if (error.code === 4001) {
        alert('用户拒绝了连接请求');
      } else if (error.code === -32002) {
        alert('请检查 MetaMask 是否已经打开并解锁');
      } else if (error.code === -32003) {
        alert('MetaMask 扩展可能已损坏，请尝试重新安装');
      } else {
        alert(`连接失败: ${error.message || '未知错误'}\n错误代码: ${error.code || '无'}`);
      }
    }
  };

  // 断开连接
  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress(undefined);
    setChainId(undefined);
  };

  // 获取 Counter 合约的数值
  const fetchCounterNumber = async () => {
    if (!address) return;
    
    const counterContract = getContract({
      address: COUNTER_ADDRESS,
      abi: Counter_ABI,
      client: publicClient,
    });

    try {
      const number = await counterContract.read.number() as bigint;
      setCounterNumber(number.toString());
    } catch (error) {
      console.error('获取 Counter 数值失败:', error);
      setCounterNumber('获取失败');
    }
  };

  // 调用 increment 函数
  const handleIncrement = async () => {
    if (!address || !window.ethereum) return;
    
    const walletClient = createWalletClient({
      chain: foundry,
      transport: custom(window.ethereum as any),
    });

    try {
      const hash = await walletClient.writeContract({
        address: COUNTER_ADDRESS,
        abi: Counter_ABI,
        functionName: 'increment',
        account: address,
      });
      console.log('Transaction hash:', hash);
      // 更新数值显示
      await fetchCounterNumber();
    } catch (error) {
      console.error('调用 increment 失败:', error);
      alert('调用合约失败，请检查网络连接和 MetaMask 状态');
    }
  };

  useEffect(() => {
    const fetchBalance = async () => {
      if (!address) return;
      
      const balance = await publicClient.getBalance({
        address: address,
      });

      setBalance(formatEther(balance));
    };

    if (address) {
      fetchBalance();
      fetchCounterNumber();
    }
  }, [address]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Simple Viem Demo</h1>
      
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-2xl border border-gray-100">
        <div className="mb-6">
          <a
            href="/siwe"
            className="block w-full bg-indigo-50 text-indigo-600 py-3 px-4 rounded-lg hover:bg-indigo-100 transition-colors text-center font-medium"
          >
            前往 SIWE 登录演示
          </a>
        </div>
        
        {!isConnected ? (
          <button
            onClick={connectWallet}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            连接 MetaMask
          </button>
        ) : (
          <div className="space-y-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">钱包地址</p>
              <p className="font-mono text-sm break-all text-gray-700">{address}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">当前网络</p>
              <p className="font-mono text-sm text-gray-700">
                {foundry.name} (Chain ID: {chainId})
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">余额</p>
              <p className="font-mono text-sm text-gray-700">{balance} ETH</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Counter 数值</p>
              <p className="font-mono text-sm text-gray-700 mb-3">{counterNumber}</p>
              <button
                onClick={handleIncrement}
                className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm"
              >
                增加计数
              </button>
            </div>
            <button
              onClick={disconnectWallet}
              className="w-full bg-gray-100 text-gray-600 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              断开连接
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
