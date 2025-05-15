'use client';

import React, { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, custom, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// 声明window.ethereum类型
declare global {
  interface Window {
    ethereum?: any;
  }
}

// 替换为你部署的合约地址
const MY_TOKEN_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`;
const TOKEN_BANK_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as `0x${string}`;

// 需要的ABI片段
const erc20PermitAbi = [
  // nonces
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "nonces", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  // permit
  { "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "value", "type": "uint256" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" },
      { "internalType": "uint8", "name": "v", "type": "uint8" },
      { "internalType": "bytes32", "name": "r", "type": "bytes32" },
      { "internalType": "bytes32", "name": "s", "type": "bytes32" }
    ], "name": "permit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

const tokenBankAbi = [
  { "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" },
      { "internalType": "uint8", "name": "v", "type": "uint8" },
      { "internalType": "bytes32", "name": "r", "type": "bytes32" },
      { "internalType": "bytes32", "name": "s", "type": "bytes32" }
    ], "name": "depositWithPermit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

// Anvil本地链配置
const chain = { 
  id: 31337, 
  name: 'Foundry本地链',
  rpcUrls: { 
    default: { 
      http: ['http://localhost:8545'] 
    } 
  },
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  }
};

export default function PermitDemo() {
  const [status, setStatus] = useState('');
  const [account, setAccount] = useState<`0x${string}` | ''>('');
  const [isMetaMask, setIsMetaMask] = useState(false);
  const [publicClient, setPublicClient] = useState<any>(null);
  const [walletClient, setWalletClient] = useState<any>(null);

  // 创建公共客户端
  useEffect(() => {
    setPublicClient(createPublicClient({ 
      chain, 
      transport: http() 
    }));
  }, []);

  // 连接到MetaMask
  const connectMetaMask = async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        setStatus('连接MetaMask...');
        
        // 请求账户访问
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0] as `0x${string}`;
        setAccount(address);
        
        // 创建钱包客户端
        const client = createWalletClient({
          chain,
          transport: custom(window.ethereum)
        });
        
        setWalletClient(client);
        setIsMetaMask(true);
        setStatus('已连接到MetaMask');
      } else {
        setStatus('未检测到MetaMask，请安装MetaMask插件');
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`MetaMask连接错误: ${err.message}`);
    }
  };

  // 使用私钥连接
  const connectWithPrivateKey = () => {
    try {
      setStatus('使用私钥连接...');
      
      // Anvil预设账户私钥
      const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const acct = privateKeyToAccount(PRIVATE_KEY);
      
      setAccount(acct.address);
      
      // 创建钱包客户端
      const client = createWalletClient({
        account: acct,
        chain,
        transport: http()
      });
      
      setWalletClient(client);
      setIsMetaMask(false);
      setStatus('已使用私钥连接');
    } catch (err: any) {
      console.error(err);
      setStatus(`私钥连接错误: ${err.message}`);
    }
  };

  const handleDepositWithPermit = async () => {
    if (!walletClient || !account || !publicClient) {
      setStatus('请先连接钱包');
      return;
    }
    
    try {
      setStatus('准备签名...');
      const value = parseEther('100');
      
      // 获取nonce
      const nonce = await publicClient.readContract({ 
        address: MY_TOKEN_ADDRESS, 
        abi: erc20PermitAbi, 
        functionName: 'nonces', 
        args: [account] 
      });
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60); // 1小时有效期

      // EIP-712类型化数据
      const domain = {
        name: 'Ptoken',
        version: '1',
        chainId: chain.id,
        verifyingContract: MY_TOKEN_ADDRESS
      };
      
      const types = { 
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ]
      };
      
      const message = { 
        owner: account, 
        spender: TOKEN_BANK_ADDRESS, 
        value, 
        nonce, 
        deadline 
      };

      setStatus('请求签名...');
      let signature;
      
      if (isMetaMask) {
        // MetaMask签名
        signature = await walletClient.signTypedData({ 
          account,
          domain, 
          types, 
          primaryType: 'Permit', 
          message 
        });
      } else {
        // 私钥签名
        signature = await walletClient.signTypedData({ 
          domain, 
          types, 
          primaryType: 'Permit', 
          message 
        });
      }
      
      const sig = signature.substring(2);
      const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
      const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
      const v = parseInt(sig.slice(128, 130), 16);

      setStatus('发送交易...');
      
      let hash;
      if (isMetaMask) {
        // MetaMask交易
        hash = await walletClient.writeContract({ 
          address: TOKEN_BANK_ADDRESS, 
          abi: tokenBankAbi, 
          functionName: 'depositWithPermit', 
          args: [account, value, deadline, v, r, s],
          account,
          chain
        });
      } else {
        // 私钥交易
        hash = await walletClient.writeContract({ 
          address: TOKEN_BANK_ADDRESS, 
          abi: tokenBankAbi, 
          functionName: 'depositWithPermit', 
          args: [account, value, deadline, v, r, s]
        });
      }

      setStatus(`交易已发送: ${hash}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`错误: ${err.message}`);
    }
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-2xl font-bold text-center mb-6">ERC20 Permit 存款演示</h1>
        <p className="text-gray-600 mb-4">使用 EIP-2612 Permit 机制进行授权和存款</p>
        
        {!account ? (
          <div className="space-y-4">
            <button 
              onClick={connectMetaMask} 
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded transition-colors"
            >
              连接 MetaMask
            </button>
            <button 
              onClick={connectWithPrivateKey} 
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded transition-colors"
            >
              使用默认私钥连接
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-gray-500 text-sm">已连接账户</p>
              <p className="font-mono text-sm truncate">{account}</p>
              <p className="text-xs text-gray-500">使用: {isMetaMask ? 'MetaMask' : '私钥'}</p>
            </div>
            
            <button 
              onClick={handleDepositWithPermit} 
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors"
            >
              Permit 存款 (100 Token)
            </button>
          </div>
        )}
        
        {status && (
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-gray-700">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
