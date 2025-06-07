'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, formatEther, getContract, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import TOKEN_ABI from './contracts/token.json';
import BANK_ABI from './contracts/bank.json';
import DELEGATE_ABI from './contracts/simpleDelegateContract.json';

// 合约地址硬编码
const TOKEN_ADDRESS = '0x00043BE121832Bb61fE41fDB7C54E09caab0017d';
const BANK_ADDRESS = '0xff5ae868B4Ea62F792C1b55c435bC241162Bbc4E';
const DELEGATE_ADDRESS = '0x25582C08E2D8956CA68FB07F00287b3397010811';

// 写死的私钥（仅演示用！）
const PRIVATE_KEY = process.env.NEXT_PUBLIC_SEPOLIA_PRIVATE_KEY!;
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL!;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(RPC_URL),
});

export default function Home() {
  // 直接用私钥账户
  const address = account.address;

  // Token 状态
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [tokenAllowance, setTokenAllowance] = useState<string>('0');

  // 转账参数
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');

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
    if (!address || !transferTo) return;
    setIsLoading(true);
    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_ADDRESS as `0x${string}`,
        abi: TOKEN_ABI,
        functionName: 'transfer',
        args: [transferTo as `0x${string}`, BigInt(transferAmount)],
      });
      showTransactionStatus('success', '交易已提交，等待确认...', hash);
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

  // 存入 Token（支持 EIP-7702）
  const handleDeposit = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      // 先查询链上代码判断账户类型
      const code = await publicClient.getBytecode({ address });
      // 构造 approve calldata
      const approveCalldata = encodeFunctionData({
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [BANK_ADDRESS, BigInt(depositAmount)],
      });
      // 构造 deposit calldata
      const depositCalldata = encodeFunctionData({
        abi: BANK_ABI,
        functionName: 'deposit',
        args: [BigInt(depositAmount)],
      });
      // 批量 calls
      const calls = [
        { to: TOKEN_ADDRESS, data: approveCalldata, value: 0n },
        { to: BANK_ADDRESS, data: depositCalldata, value: 0n },
      ];
      // 构造 execute calldata
      const executeCalldata = encodeFunctionData({
        abi: DELEGATE_ABI,
        functionName: 'execute',
        args: [calls],
      });
      let hash: `0x${string}`;
      if (typeof code === 'string' && code.length > 0) {
        // 已经是合约账户，直接 sendTransaction
        hash = await walletClient.sendTransaction({
          to: address,
          data: executeCalldata,
        }) as `0x${string}`;
      } else {
        // 还不是合约账户，先 sign 授权再 writeContract
        const authorization = await walletClient.signAuthorization({
          contractAddress: DELEGATE_ADDRESS,
          executor: 'self',
        });
        hash = await walletClient.writeContract({
          abi: DELEGATE_ABI,
          address: address,
          functionName: 'execute',
          args: [calls],
          authorizationList: [authorization],
        }) as `0x${string}`;
      }
      showTransactionStatus('success', '批量存入交易已提交，等待确认...', hash);
      const success = await waitForTransaction(hash);
      if (success) {
        showTransactionStatus('success', '存入成功！');
        await Promise.all([fetchTokenInfo(), fetchBankBalance()]);
        setDepositAmount('');
      } else {
        showTransactionStatus('error', '存入失败，请重试');
      }
    } catch (error: any) {
      console.error('批量存入失败:', error);
      showTransactionStatus('error', `批量存入失败: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 提取 Token
  const handleWithdraw = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const hash = await walletClient.writeContract({
        address: BANK_ADDRESS as `0x${string}`,
        abi: BANK_ABI,
        functionName: 'withdraw',
      });
      showTransactionStatus('success', '提取交易已提交，等待确认...', hash);
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
    fetchTokenInfo();
    fetchBankBalance();
    // eslint-disable-next-line
  }, []);

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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E5E7EB] mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#6B7280]">当前账户地址：</span>
            <span className="font-mono text-sm text-[#1A1B1F]">{address}</span>
          </div>
        </div>
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
        </div>
      </div>
    </div>
  );
} 