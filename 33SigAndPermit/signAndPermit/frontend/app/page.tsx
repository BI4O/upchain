"use client";

import { useState, useEffect } from 'react';
import { publicActions, http, createWalletClient, parseEther, getContract, formatEther, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import MyTokenABI from '../abis/MyToken.json';
import TokenBankABI from '../abis/tokenBank.json';

export default function Home() {
  // 状态变量
  const [account, setAccount] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [bankBalance, setBankBalance] = useState<string>('0');
  const [transferAmount, setTransferAmount] = useState<string>('0');
  const [depositAmount, setDepositAmount] = useState<string>('0');
  const [permitAmount, setPermitAmount] = useState<string>('0');
  const [recipient, setRecipient] = useState<string>('0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9');
  const [status, setStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [client, setClient] = useState<any>(null);
  const [token, setToken] = useState<any>(null);
  const [bank, setBank] = useState<any>(null);
  const [approvedAmount, setApprovedAmount] = useState<string>('0');

  // 合约地址
  const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address;
  const bankAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address;

  // 初始化
  useEffect(() => {
    async function initialize() {
      try {
        // 账户
        const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const account = privateKeyToAccount(privateKey);
        setAccount(account.address);

        // 创建钱包客户端
        const newClient = createWalletClient({
          chain: foundry,
          transport: http("http://localhost:8545")
        }).extend(publicActions);
        setClient(newClient);

        // 初始化合约实例
        const tokenContract = getContract({
          address: tokenAddress,
          abi: MyTokenABI,
          client: newClient,
        });
        setToken(tokenContract);

        const bankContract = getContract({
          address: bankAddress,
          abi: TokenBankABI,
          client: newClient,
        });
        setBank(bankContract);

        // 获取初始余额
        await updateBalances(tokenContract, bankContract, account.address);
      } catch (error) {
        console.error("初始化错误:", error);
        setStatus("初始化失败，请确保连接到本地区块链");
      }
    }

    initialize();
  }, []);

  // 更新余额的函数
  async function updateBalances(tokenContract: any, bankContract: any, accountAddress: string) {
    try {
      if (!tokenContract || !bankContract) return;

      const tokenBal = await tokenContract.read.balanceOf([accountAddress]);
      const bankBal = await bankContract.read.balanceOf([accountAddress]);
      
      setTokenBalance(formatEther(tokenBal));
      setBankBalance(formatEther(bankBal));
    } catch (error) {
      console.error("获取余额错误:", error);
      setStatus("获取余额失败");
    }
  }

  // 转账功能
  async function handleTransfer() {
    try {
      setStatus("转账处理中...");
      if (!token || !client || !account) {
        setStatus("合约实例未初始化");
        return;
      }

      const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const acc = privateKeyToAccount(privateKey);

      const amount = parseEther(transferAmount);
      const transferTx = await token.write.transfer([
        recipient,
        amount
      ], {
        account: acc
      });

      setTxHash(transferTx);
      setStatus(`转账成功! 交易哈希: ${transferTx}`);
      await updateBalances(token, bank, account);
    } catch (error) {
      console.error("转账错误:", error);
      setStatus("转账失败");
    }
  }

  // 授权功能
  async function handleApprove() {
    try {
      setStatus("授权处理中...");
      if (!token || !client || !account) {
        setStatus("合约实例未初始化");
        return;
      }

      const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const acc = privateKeyToAccount(privateKey);
      const amount = parseEther(depositAmount);

      // 授权
      setStatus("授权Bank合约使用代币...");
      const approveTx = await token.write.approve([
        bankAddress,
        amount
      ], {
        account: acc
      });
      setTxHash(approveTx);
      setStatus(`授权成功! 交易哈希: ${approveTx}`);
      setApprovedAmount(depositAmount);
      
      // 检查授权额度
      const allowance = await token.read.allowance([account, bankAddress]);
      setStatus(`授权成功! 授权额度: ${formatEther(allowance)}`);
    } catch (error) {
      console.error("授权错误:", error);
      setStatus("授权失败");
    }
  }

  // 存款功能
  async function handleDeposit() {
    try {
      setStatus("存款处理中...");
      if (!bank || !client || !account) {
        setStatus("合约实例未初始化");
        return;
      }

      const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const acc = privateKeyToAccount(privateKey);
      const amount = parseEther(depositAmount);

      // 检查授权额度
      const allowance = await token.read.allowance([account, bankAddress]);
      if (allowance < amount) {
        setStatus(`授权额度不足! 当前授权: ${formatEther(allowance)}, 需要: ${depositAmount}`);
        return;
      }

      // 存款
      const depositTx = await bank.write.deposit([amount], {
        account: acc
      });
      setTxHash(depositTx);
      setStatus(`存款成功! 交易哈希: ${depositTx}`);
      
      await updateBalances(token, bank, account);
    } catch (error) {
      console.error("存款错误:", error);
      setStatus("存款失败");
    }
  }

  // Permit存款功能
  async function handlePermitDeposit() {
    try {
      setStatus("Permit存款处理中...");
      if (!token || !bank || !client || !account) {
        setStatus("合约实例未初始化");
        return;
      }

      const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const acc = privateKeyToAccount(privateKey);
      const amount = parseEther(permitAmount);

      // 获取nonce
      const nonce = await token.read.nonces([account]);
      setStatus(`获取nonce: ${nonce}`);

      // 获取chainId
      const chainId = await client.getChainId();
      
      // 获取代币名称
      const tokenName = await token.read.name() as string;
      
      // 设置deadline (1小时后过期)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      // Permit消息
      const domain = {
        name: tokenName,
        version: '1',
        chainId: chainId,
        verifyingContract: tokenAddress
      };
      
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };
      
      const message = {
        owner: account,
        spender: bankAddress,
        value: amount,
        nonce: nonce,
        deadline: deadline
      };
      
      setStatus("正在签名Permit消息...");
      
      // 签名permit消息
      const signature = await client.signTypedData({
        account: acc,
        domain: domain,
        types: types,
        primaryType: 'Permit',
        message: message
      });
      
      // 从签名中提取v, r, s
      const r = `0x${signature.substring(2, 66)}` as Hex;
      const s = `0x${signature.substring(66, 130)}` as Hex;
      const v = parseInt(signature.substring(130, 132), 16);
      
      setStatus("正在使用PermitDeposit...");
      
      // 使用depositWithPermit方法
      const depositWithPermitTx = await bank.write.depositWithPermit([
        account,
        amount,
        deadline,
        v,
        r,
        s
      ], {
        account: acc
      });
      
      setTxHash(depositWithPermitTx);
      setStatus(`Permit存款成功! 交易哈希: ${depositWithPermitTx}`);
      
      await updateBalances(token, bank, account);
    } catch (error) {
      console.error("Permit存款错误:", error);
      setStatus("Permit存款失败");
    }
  }

  // 提款功能
  async function handleWithdraw() {
    try {
      setStatus("提款处理中...");
      if (!bank || !client || !account) {
        setStatus("合约实例未初始化");
        return;
      }

      const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const acc = privateKeyToAccount(privateKey);

      const withdrawTx = await bank.write.withdraw([], {
        account: acc
      });
      
      setTxHash(withdrawTx);
      setStatus(`提款成功! 交易哈希: ${withdrawTx}`);
      
      await updateBalances(token, bank, account);
    } catch (error) {
      console.error("提款错误:", error);
      setStatus("提款失败");
    }
  }

  // 手动刷新余额
  async function refreshBalances() {
    if (token && bank && account) {
      setStatus("刷新余额中...");
      await updateBalances(token, bank, account);
      setStatus("余额已刷新");
    }
  }

  return (
    <main className="flex min-h-screen p-4 bg-gray-100">
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* 左侧区域：账户信息和状态 */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* 标题 */}
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">EIP2612 Permit 演示</h1>
          
          {/* 账户信息部分 - 固定位置显示 */}
          <div className="sticky top-4 bg-blue-50 p-3 rounded-md shadow">
            <h2 className="text-lg font-semibold mb-2 text-gray-800">账户信息</h2>
            <div className="mb-2 text-gray-800 text-sm overflow-hidden text-ellipsis"><strong>地址:</strong> {account}</div>
            <div className="mb-2 text-gray-800 text-xl"><strong>代币余额:</strong> {tokenBalance} MTK</div>
            <div className="mb-2 text-gray-800 text-xl"><strong>银行存款:</strong> {bankBalance} MTK</div>
            <button 
              onClick={refreshBalances}
              className="mt-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm active:transform active:scale-95 active:bg-blue-800 transition-all duration-150"
            >
              刷新余额
            </button>
          </div>
          
          {/* 转账部分 */}
          <div className="bg-white p-3 rounded-md shadow-md">
            <h2 className="text-lg font-semibold mb-2 text-gray-800">转账代币</h2>
            <div className="flex flex-col gap-2">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">接收地址</label>
                <input 
                  type="text" 
                  value={recipient} 
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full p-1.5 border rounded text-gray-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">金额</label>
                <input 
                  type="text" 
                  value={transferAmount} 
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full p-1.5 border rounded text-gray-800 text-sm"
                />
              </div>
              <button 
                onClick={handleTransfer}
                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 font-medium active:transform active:scale-95 active:bg-green-800 transition-all duration-150"
              >
                转账
              </button>
            </div>
          </div>
          
          {/* 提款部分 */}
          <div className="bg-white p-3 rounded-md shadow-md">
            <h2 className="text-lg font-semibold mb-2 text-gray-800">从银行提款</h2>
            <button 
              onClick={handleWithdraw}
              className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 font-medium w-full active:transform active:scale-95 active:bg-red-800 transition-all duration-150"
            >
              提取所有存款
            </button>
          </div>
          
          {/* 状态显示 */}
          <div className="bg-gray-800 p-3 rounded-md shadow-md text-white">
            <h2 className="text-lg font-semibold mb-1">状态</h2>
            <p className="font-medium text-sm">{status}</p>
            {txHash && (
              <p className="mt-1 text-xs overflow-hidden text-ellipsis text-gray-300 break-all">
                交易: {txHash.substring(0, 10)}...{txHash.substring(txHash.length-4)}
              </p>
            )}
          </div>
        </div>
        
        {/* 右侧区域：存款方式 */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="bg-white p-3 rounded-md shadow-md">
            <h2 className="text-xl font-semibold mb-3 text-gray-800 text-center">两种银行存款方式比较</h2>
            
            {/* 常规存款 - 拆分为两个步骤 */}
            <div className="mb-4 bg-yellow-50 p-3 rounded-md">
              <h3 className="font-medium mb-2 text-gray-800 border-b pb-1">方式1: Approve 然后 Deposit (两笔交易)</h3>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">金额</label>
                  <input 
                    type="text" 
                    value={depositAmount} 
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full p-1.5 border rounded text-gray-800 text-sm"
                  />
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={handleApprove}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium flex-1 active:transform active:scale-95 active:bg-purple-800 transition-all duration-150"
                  >
                    第一步: Approve 授权
                  </button>
                  <button 
                    onClick={handleDeposit}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex-1 active:transform active:scale-95 active:bg-blue-800 transition-all duration-150"
                  >
                    第二步: Deposit 存款
                  </button>
                </div>
                {approvedAmount !== '0' && (
                  <div className="text-sm text-gray-700 mt-1">
                    已授权金额: {approvedAmount} MTK
                  </div>
                )}
              </div>
            </div>
            
            {/* Permit存款 */}
            <div className="bg-green-50 p-3 rounded-md">
              <h3 className="font-medium mb-2 text-gray-800 border-b pb-1">方式2: Permit存款 (一笔交易)</h3>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">存款金额</label>
                  <input 
                    type="text" 
                    value={permitAmount} 
                    onChange={(e) => setPermitAmount(e.target.value)}
                    className="w-full p-1.5 border rounded text-gray-800 text-sm"
                  />
                </div>
                <button 
                  onClick={handlePermitDeposit}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium active:transform active:scale-95 active:bg-indigo-800 transition-all duration-150"
                >
                  一步完成: PermitDeposit
                </button>
              </div>
            </div>
            
            {/* EIP2612说明 */}
            <div className="mt-4 text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <p><strong>EIP2612优势:</strong> 通过离线签名允许一步完成授权和存款，节省gas费并改善用户体验。</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
