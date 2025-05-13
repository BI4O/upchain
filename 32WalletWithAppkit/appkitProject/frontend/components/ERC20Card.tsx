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
import { parseUnits, formatUnits } from 'viem';
import AlertModal from './AlertModal';

// 导入合约ABI
import ERC20tokenABI from '../app/contract/ERC20token_abi.json';

// 常量
const FOUNDRY_CHAIN_ID = 31337;
const marketAddr = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const ERC20Addr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const wallet1Addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // 部署者地址

// 合约配置
const tokenContract = {
  address: ERC20Addr as `0x${string}`,
  abi: ERC20tokenABI
};

export default function ERC20Card() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState<string>('10');
  const [recipient, setRecipient] = useState<string>('');
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const [approvalAmount, setApprovalAmount] = useState('');
  const [approvalInProgress, setApprovalInProgress] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 转账函数
  const { data: hash, isPending, writeContract } = useWriteContract();
  
  // 转账等待确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ 
      hash,
    });

  // 查询代币余额
  const { data: tokenBalance, refetch } = useReadContract({
    ...tokenContract,
    functionName: 'balanceOf',
    args: [isConnected ? address : wallet1Addr],
    chainId,
    query: {
      enabled: isConnected || !!wallet1Addr,
    }
  });
  
  // 查询代币总供应量
  const { data: totalSupply } = useReadContract({
    ...tokenContract,
    functionName: 'totalSupply',
    chainId,
    query: {
      enabled: true,
    }
  });
  
  // 判断当前用户是否是合约拥有者
  const { data: ownerAddress } = useReadContract({
    ...tokenContract,
    functionName: 'owner',
    chainId,
    query: {
      enabled: isConnected,
    }
  });
  
  // 检查是否是合约拥有者
  useEffect(() => {
    if (isConnected && address && ownerAddress) {
      setIsOwner(address.toLowerCase() === (ownerAddress as string).toLowerCase());
    } else {
      setIsOwner(false);
    }
  }, [address, ownerAddress, isConnected]);
  
  // 转账成功后重新获取余额
  useEffect(() => {
    if (isConfirmed) {
      refetch();
      // 清空输入框
      setAmount('10');
      setRecipient('');
      // 显示成功提示
      setSuccessMessage('代币转账成功！');
      setShowSuccessModal(true);
    }
  }, [isConfirmed, refetch]);
  
  // 查询余额和授权额度
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!address || chainId !== FOUNDRY_CHAIN_ID || !publicClient) return;

      try {
        // 查询余额
        const balanceResult = await publicClient.readContract({
          ...tokenContract,
          functionName: 'balanceOf',
          args: [address]
        }) as bigint;

        // 查询授权额度
        const allowanceResult = await publicClient.readContract({
          ...tokenContract,
          functionName: 'allowance',
          args: [address, marketAddr]
        }) as bigint;

        setBalance(balanceResult);
        setAllowance(allowanceResult);
      } catch (error) {
        console.error('获取代币信息失败:', error);
      }
    };

    fetchTokenInfo();
  }, [address, chainId, publicClient, approvalInProgress]);
  
  // 处理转账
  const handleTransfer = () => {
    if (!isConnected || !address) {
      alert('请先连接钱包');
      return;
    }
    
    if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      alert('请输入有效的接收地址');
      return;
    }
    
    try {
      const amountInWei = parseUnits(amount, 18);
      writeContract({
        ...tokenContract,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amountInWei],
      });
    } catch (error) {
      console.error('转账失败:', error);
      alert('转账失败，请检查金额和地址');
    }
  };
  
  // 处理接收地址修改
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipient(e.target.value);
  };
  
  // 处理金额修改
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 确保输入的是有效数字
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };
  
  // 处理ERC20授权
  const handleApproveERC20 = async () => {
    if (!isConnected || !address) return alert('请先连接钱包');
    if (!approvalAmount) return alert('请输入授权金额');

    try {
      setApprovalInProgress(true);
      await writeContract({
        ...tokenContract,
        functionName: 'approve',
        args: [marketAddr, BigInt(approvalAmount)],
      });
      
      // 等待3秒后刷新
      setTimeout(() => {
        setApprovalInProgress(false);
        setApprovalAmount('');
      }, 3000);
    } catch (error) {
      console.error('授权失败:', error);
      alert('授权失败');
      setApprovalInProgress(false);
    }
  };
  
  // 如果不是foundry网络，显示提示
  if (chainId !== FOUNDRY_CHAIN_ID) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <h2 className="text-lg font-bold mb-2 text-gray-800">TK代币</h2>
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded-md text-sm">
          请切换到Foundry网络以使用TK代币功能
        </div>
      </div>
    );
  }
  
  return (
    <div className="token-card">
      <h2 className="token-card-title">TK 代币</h2>
      
      {/* 代币信息面板 */}
      <div className="token-inset-panel mb-4">
        <div className="flex justify-between items-center">
          <span className="token-info-text">余额</span>
          <span className="token-value-text">{tokenBalance ? formatUnits(tokenBalance, 18) : '0'} TK</span>
        </div>
      </div>

      {/* 转账面板 */}
      <div className="token-inset-panel mb-4">
        <div className="flex justify-between items-center gap-4">
          {/* 左侧输入框区域 */}
          <div className="flex-1 space-y-2">
            <div>
              <label className="token-label-text">接收地址</label>
              <input
                type="text"
                className="token-input"
                placeholder="输入接收地址"
                value={recipient}
                onChange={handleAddressChange}
              />
            </div>
            <div>
              <label className="token-label-text">转账数量</label>
              <input
                type="text"
                className="token-input"
                placeholder="输入转账数量"
                value={amount}
                onChange={handleAmountChange}
              />
            </div>
          </div>
          {/* 右侧按钮区域 */}
          <div className="flex items-center">
            <button
              className="token-btn bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleTransfer}
              disabled={!isConnected || !amount || !recipient}
            >
              转账
            </button>
          </div>
        </div>
      </div>

      {/* 授权面板 */}
      <div className="token-inset-panel">
        <div className="flex justify-between items-center gap-4">
          {/* 左侧输入框区域 */}
          <div className="flex-1">
            <label className="token-label-text">授权数量</label>
            <input
              type="text"
              className="token-input"
              placeholder="输入授权数量"
              value={approvalAmount}
              onChange={(e) => setApprovalAmount(e.target.value)}
            />
          </div>
          {/* 右侧按钮区域 */}
          <div className="flex items-center">
            <button
              className="token-btn bg-purple-500 hover:bg-purple-600 text-white"
              onClick={handleApproveERC20}
              disabled={!isConnected || approvalInProgress}
            >
              授权
            </button>
          </div>
        </div>
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