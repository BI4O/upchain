'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, formatEther, getContract, custom } from 'viem';
import { sepolia } from 'viem/chains';
import TOKEN_ABI from './contracts/token.json';
import BANK_ABI from './contracts/bank.json';

// 合约地址
const TOKEN_ADDRESS = "0xf6c5618616bff10421abe1509faeb2bec81629f6";
const BANK_ADDRESS = "0xd112c16d00ce96f8ac807f2b46283e5635b51d68";

export default function Home() {
  const [address, setAddress] = useState<`0x${string}` | undefined>();
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | undefined>();
  
  // Token 状态
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [tokenAllowance, setTokenAllowance] = useState<string>('0');
  
  // 转账参数
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  
  // 授权参数
  const [approveSpender, setApproveSpender] = useState<string>(BANK_ADDRESS);
  const [approveAmount, setApproveAmount] = useState<string>('');
  
  // Bank 状态
  const [bankBalance, setBankBalance] = useState<string>('0');
  const [depositAmount, setDepositAmount] = useState<string>('');

  // 交易状态
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    hash?: string;
  }>({ type: null, message: '' });

  const publicClient = createPublicClient({
    chain: sepolia,
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
      
      // 检查是否在正确的网络上
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log('当前链 ID:', chainId);
      
      if (chainId !== '0xaa36a7') { // Sepolia 的 chainId
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Sepolia 的 chainId
          });
        } catch (switchError: any) {
          // 如果 Sepolia 网络未添加，则添加它
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0xaa36a7',
                    chainName: 'Sepolia',
                    nativeCurrency: {
                      name: 'SepoliaETH',
                      symbol: 'SEP',
                      decimals: 18,
                    },
                    rpcUrls: ['https://rpc.sepolia.org'],
                    blockExplorerUrls: ['https://sepolia.etherscan.io'],
                  },
                ],
              });
            } catch (addError) {
              console.error('添加 Sepolia 网络失败:', addError);
              alert('请手动添加 Sepolia 测试网到 MetaMask');
              return;
            }
          } else {
            console.error('切换网络失败:', switchError);
            alert('请手动切换到 Sepolia 测试网');
            return;
          }
        }
      }

      // 请求连接账户
      console.log('请求连接账户...');
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts',
        params: []
      }).catch((error: any) => {
        console.error('请求账户失败:', error);
        throw error;
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('未获取到账户');
      }

      const address = accounts[0];
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
        // 如果切换到其他网络，断开连接
        if (chainId !== '0xaa36a7') {
          setIsConnected(false);
          setAddress(undefined);
          alert('请切换到 Sepolia 测试网');
        }
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

  // 获取 Token 信息
  const fetchTokenInfo = async () => {
    if (!address) return;
    
    const tokenContract = getContract({
      address: TOKEN_ADDRESS as `0x${string}`,
      abi: TOKEN_ABI,
      client: publicClient,
    });

    try {
      const [name, symbol, balance, allowance] = await Promise.all([
        tokenContract.read.name(),
        tokenContract.read.symbol(),
        tokenContract.read.balanceOf([address]),
        tokenContract.read.allowance([address, BANK_ADDRESS as `0x${string}`]),
      ]);

      setTokenName(name as string);
      setTokenSymbol(symbol as string);
      setTokenBalance((balance as bigint).toString());
      setTokenAllowance((allowance as bigint).toString());
    } catch (error) {
      console.error('获取 Token 信息失败:', error);
    }
  };

  // 获取 Bank 余额
  const fetchBankBalance = async () => {
    if (!address) return;
    
    const bankContract = getContract({
      address: BANK_ADDRESS as `0x${string}`,
      abi: BANK_ABI,
      client: publicClient,
    });

    try {
      const balance = await bankContract.read.balances([address]);
      setBankBalance((balance as bigint).toString());
    } catch (error) {
      console.error('获取 Bank 余额失败:', error);
    }
  };

  // 显示交易状态
  const showTransactionStatus = (type: 'success' | 'error', message: string, hash?: string) => {
    setTransactionStatus({ type, message, hash });
    // 3秒后自动清除状态
    setTimeout(() => {
      setTransactionStatus({ type: null, message: '' });
    }, 3000);
  };

  // 等待交易确认
  const waitForTransaction = async (hash: `0x${string}`) => {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt.status === 'success';
    } catch (error) {
      console.error('等待交易确认失败:', error);
      return false;
    }
  };

  // 转账 Token
  const handleTransfer = async () => {
    if (!address || !window.ethereum || !transferTo) return;
    
    setIsLoading(true);
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum as any),
    });

    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_ADDRESS as `0x${string}`,
        abi: TOKEN_ABI,
        functionName: 'transfer',
        args: [transferTo as `0x${string}`, BigInt(transferAmount)],
        account: address,
      });
      
      showTransactionStatus('success', '交易已提交，等待确认...', hash);
      
      // 等待交易确认
      const success = await waitForTransaction(hash);
      if (success) {
        showTransactionStatus('success', '转账成功！');
        await fetchTokenInfo();
        setTransferTo('');
        setTransferAmount('');
      } else {
        showTransactionStatus('error', '转账失败，请重试');
      }
    } catch (error: any) {
      console.error('转账失败:', error);
      showTransactionStatus('error', `转账失败: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 授权 Token
  const handleApprove = async () => {
    if (!address || !window.ethereum || !approveSpender) return;
    
    setIsLoading(true);
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum as any),
    });

    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_ADDRESS as `0x${string}`,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [approveSpender as `0x${string}`, BigInt(approveAmount)],
        account: address,
      });
      
      showTransactionStatus('success', '授权交易已提交，等待确认...', hash);
      
      // 等待交易确认
      const success = await waitForTransaction(hash);
      if (success) {
        showTransactionStatus('success', '授权成功！');
        await fetchTokenInfo();
        setApproveAmount('');
      } else {
        showTransactionStatus('error', '授权失败，请重试');
      }
    } catch (error: any) {
      console.error('授权失败:', error);
      showTransactionStatus('error', `授权失败: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 存入 Token
  const handleDeposit = async () => {
    if (!address || !window.ethereum) return;
    
    setIsLoading(true);
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum as any),
    });

    try {
      const hash = await walletClient.writeContract({
        address: BANK_ADDRESS as `0x${string}`,
        abi: BANK_ABI,
        functionName: 'deposit',
        args: [BigInt(depositAmount)],
        account: address,
      });
      
      showTransactionStatus('success', '存入交易已提交，等待确认...', hash);
      
      // 等待交易确认
      const success = await waitForTransaction(hash);
      if (success) {
        showTransactionStatus('success', '存入成功！');
        await Promise.all([fetchTokenInfo(), fetchBankBalance()]);
        setDepositAmount('');
      } else {
        showTransactionStatus('error', '存入失败，请重试');
      }
    } catch (error: any) {
      console.error('存入失败:', error);
      showTransactionStatus('error', `存入失败: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 提取 Token
  const handleWithdraw = async () => {
    if (!address || !window.ethereum) return;
    
    setIsLoading(true);
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum as any),
    });

    try {
      const hash = await walletClient.writeContract({
        address: BANK_ADDRESS as `0x${string}`,
        abi: BANK_ABI,
        functionName: 'withdraw',
        account: address,
      });
      
      showTransactionStatus('success', '提取交易已提交，等待确认...', hash);
      
      // 等待交易确认
      const success = await waitForTransaction(hash);
      if (success) {
        showTransactionStatus('success', '提取成功！');
        await Promise.all([fetchTokenInfo(), fetchBankBalance()]);
      } else {
        showTransactionStatus('error', '提取失败，请重试');
      }
    } catch (error: any) {
      console.error('提取失败:', error);
      showTransactionStatus('error', `提取失败: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchTokenInfo();
      fetchBankBalance();
    }
  }, [address]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#F7F8FA]">
      <h1 className="text-3xl font-semibold mb-8 text-[#1A1B1F]">Token & Bank Demo</h1>
      
      <div className="w-full max-w-6xl">
        {/* 交易状态提示 */}
        {transactionStatus.type && (
          <div className={`mb-6 p-3 rounded-xl ${
            transactionStatus.type === 'success' ? 'bg-[#E6F4EA] text-[#1E4620]' : 'bg-[#FCE8E6] text-[#C5221F]'
          }`}>
            <p className="font-medium text-sm">{transactionStatus.message}</p>
            {transactionStatus.hash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionStatus.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline mt-1 inline-block"
              >
                在 Etherscan 上查看
              </a>
            )}
          </div>
        )}

        {!isConnected ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E5E7EB]">
            <button
              onClick={connectWallet}
              className="w-full bg-[#1A1B1F] text-white py-2.5 px-4 rounded-xl hover:bg-[#2C2D32] transition-colors font-medium text-sm shadow-sm"
            >
              连接 MetaMask
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Token 部分 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E5E7EB]">
              <h2 className="text-lg font-medium text-[#1A1B1F] mb-4">Token 操作</h2>
              
              <div className="p-4 bg-[#F7F8FA] rounded-xl mb-4">
                <p className="text-xs text-[#6B7280] mb-3 font-medium">Token 信息</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280]">名称</span>
                    <span className="font-mono text-sm text-[#1A1B1F]">{tokenName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280]">符号</span>
                    <span className="font-mono text-sm text-[#1A1B1F]">{tokenSymbol}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280]">余额</span>
                    <span className="font-mono text-sm text-[#1A1B1F]">{tokenBalance}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7280]">授权额度</span>
                    <span className="font-mono text-sm text-[#1A1B1F]">{tokenAllowance}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1">
                    转账地址
                  </label>
                  <input
                    type="text"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1A1B1F] focus:border-[#1A1B1F] text-sm bg-white"
                    placeholder="输入接收地址"
                    disabled={isLoading}
                  />
                  <label className="block text-xs font-medium text-[#6B7280] mb-1 mt-2">
                    转账金额
                  </label>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1A1B1F] focus:border-[#1A1B1F] text-sm bg-white"
                    placeholder="输入转账金额"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleTransfer}
                    className="mt-2 w-full bg-[#1A1B1F] text-white py-2 px-4 rounded-xl hover:bg-[#2C2D32] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? '处理中...' : '转账'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1">
                    授权地址
                  </label>
                  <input
                    type="text"
                    value={approveSpender}
                    onChange={(e) => setApproveSpender(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1A1B1F] focus:border-[#1A1B1F] text-sm bg-white"
                    placeholder="输入授权地址"
                    disabled={isLoading}
                  />
                  <label className="block text-xs font-medium text-[#6B7280] mb-1 mt-2">
                    授权金额
                  </label>
                  <input
                    type="number"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1A1B1F] focus:border-[#1A1B1F] text-sm bg-white"
                    placeholder="输入授权金额"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleApprove}
                    className="mt-2 w-full bg-[#1A1B1F] text-white py-2 px-4 rounded-xl hover:bg-[#2C2D32] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? '处理中...' : '授权'}
                  </button>
                </div>
              </div>
            </div>

            {/* Bank 部分 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E5E7EB]">
              <h2 className="text-lg font-medium text-[#1A1B1F] mb-4">Bank 操作</h2>
              
              <div className="p-4 bg-[#F7F8FA] rounded-xl mb-4">
                <p className="text-xs text-[#6B7280] mb-3 font-medium">Bank 余额</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">当前余额</span>
                  <span className="font-mono text-sm text-[#1A1B1F]">{bankBalance} {tokenSymbol}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1">
                    存入金额
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1A1B1F] focus:border-[#1A1B1F] text-sm bg-white"
                    placeholder="输入存入金额"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleDeposit}
                    className="mt-2 w-full bg-[#1A1B1F] text-white py-2 px-4 rounded-xl hover:bg-[#2C2D32] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? '处理中...' : '存入'}
                  </button>
                </div>

                <button
                  onClick={handleWithdraw}
                  className="w-full bg-[#1A1B1F] text-white py-2 px-4 rounded-xl hover:bg-[#2C2D32] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? '处理中...' : '提取全部'}
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <button
                onClick={disconnectWallet}
                className="w-full bg-[#F7F8FA] text-[#6B7280] py-2 px-4 rounded-xl hover:bg-[#E5E7EB] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                断开连接
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 