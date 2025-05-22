"use client";
import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient, useBlockNumber } from "wagmi";
import { injected } from "@wagmi/connectors";
import { parseEther, formatEther } from "viem";
import MyTokenABI from "../abis/MyToken.json";
import TokenBankABI from "../abis/tokenBank.json";
import Permit2ABI from "../abis/Permit2.json";

// 合约地址
const MYTOKEN_ADDR = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const BANK_ADDR = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const PERMIT2_ADDR = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

export default function Home() {
  // hooks始终调用
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const [tokenBalance, setTokenBalance] = useState("0");
  const [bankBalance, setBankBalance] = useState("0");
  const [depositAmount, setDepositAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 查询余额
  async function fetchBalances() {
    if (!address || !publicClient) return;
    // MyToken余额
    const bal = await publicClient.readContract({
      address: MYTOKEN_ADDR,
      abi: MyTokenABI,
      functionName: "balanceOf",
      args: [address],
    });
    setTokenBalance(bal ? formatEther(BigInt(bal as any)) : "0");
    // 银行余额
    const bankBal = await publicClient.readContract({
      address: BANK_ADDR,
      abi: TokenBankABI,
      functionName: "balanceOf",
      args: [address],
    });
    setBankBalance(bankBal ? formatEther(BigInt(bankBal as any)) : "0");
  }

  useEffect(() => {
    if (isConnected) fetchBalances();
    // eslint-disable-next-line
  }, [isConnected, address, txHash, blockNumber]);

  // 自动授权Permit2最大额度
  useEffect(() => {
    async function autoApprovePermit2() {
      if (!walletClient || !address || !publicClient) return;
      try {
        const allowance = await publicClient.readContract({
          address: MYTOKEN_ADDR,
          abi: MyTokenABI,
          functionName: "allowance",
          args: [address, PERMIT2_ADDR],
        });
        const max = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        if (BigInt(allowance as string) < max) {
          await walletClient.writeContract({
            address: MYTOKEN_ADDR,
            abi: MyTokenABI,
            functionName: "approve",
            args: [PERMIT2_ADDR, max],
            account: address,
          });
        }
      } catch (e) {
        // 忽略授权失败
      }
    }
    if (isConnected && mounted) autoApprovePermit2();
  }, [isConnected, address, walletClient, publicClient, mounted]);

  // 传统approve+deposit
  async function handleApproveAndDeposit() {
    setError("");
    setLoading(true);
    try {
      if (!walletClient || !address) throw new Error("请先连接钱包");
      const amount = parseEther(depositAmount);
      // 1. approve
      const approveHash = await walletClient.writeContract({
        address: MYTOKEN_ADDR,
        abi: MyTokenABI,
        functionName: "approve",
        args: [BANK_ADDR, amount],
        account: address,
      });
      // 等待approve上链
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });
      // 2. deposit
      const depositHash = await walletClient.writeContract({
        address: BANK_ADDR,
        abi: TokenBankABI,
        functionName: "deposit",
        args: [amount],
        account: address,
      });
      setTxHash(depositHash);
    } catch (e: any) {
      setError(e.message || "交易失败");
    }
    setLoading(false);
  }

  // permit2存钱
  async function handlePermit2Deposit() {
    setError("");
    setLoading(true);
    try {
      if (!walletClient || !address) throw new Error("请先连接钱包");
      const amount = parseEther(depositAmount);
      // 1. 先approve给Permit2
      const approveHash = await walletClient.writeContract({
        address: MYTOKEN_ADDR,
        abi: MyTokenABI,
        functionName: "approve",
        args: [PERMIT2_ADDR, amount],
        account: address,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });
      // 2. 构造permit2 EIP-712数据
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1小时后过期
      const nonce = 0; // 简化演示，实际应查询permit2 nonce
      const types = {
        PermitTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      };
      const value = {
        permitted: {
          token: MYTOKEN_ADDR,
          amount: amount,
        },
        nonce: nonce,
        deadline: deadline,
      };
      // 3. 让用户用钱包签名EIP-712
      const signature = await walletClient.signTypedData({
        domain: {
          name: "Permit2",
          chainId: await walletClient.getChainId(),
          verifyingContract: PERMIT2_ADDR,
        },
        types,
        primaryType: "PermitTransferFrom",
        message: value,
        account: address,
      });
      // 4. 调用depositWithPermit2
      const depositHash = await walletClient.writeContract({
        address: BANK_ADDR,
        abi: TokenBankABI,
        functionName: "depositWithPermit2",
        args: [address, amount, deadline, signature],
        account: address,
      });
      setTxHash(depositHash);
    } catch (e: any) {
      setError(e.message || JSON.stringify(e) || "交易失败");
      console.error("permit2 error", e);
    }
    setLoading(false);
  }

  // 提现
  async function handleWithdraw() {
    setError("");
    setLoading(true);
    try {
      if (!walletClient || !address) throw new Error("请先连接钱包");
      if (Number(bankBalance) === 0) throw new Error("银行余额为0，无法提现");
      const hash = await walletClient.writeContract({
        address: BANK_ADDR,
        abi: TokenBankABI,
        functionName: "withdraw",
        args: [],
        account: address,
      });
      setTxHash(hash);
    } catch (e: any) {
      setError(e.message || "提现失败");
    }
    setLoading(false);
  }

  // 只在mounted后渲染主要内容
  if (!mounted) {
    return <main />;
  }

  return (
    <main className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-4">Ptoken 银行演示</h1>
      {!isConnected ? (
        <button onClick={() => connect({ connector: injected() })} className="px-4 py-2 bg-blue-600 text-white rounded">连接MetaMask</button>
      ) : (
        <div className="mb-4">
          <div className="mb-2">钱包地址: <span className="font-mono">{address}</span></div>
          <div className="mb-2">Ptoken余额: {tokenBalance}</div>
          <div className="mb-2">银行余额: {bankBalance}</div>
          <button onClick={() => disconnect()} className="px-2 py-1 bg-gray-300 rounded">断开连接</button>
        </div>
      )}
      {isConnected && (
        <>
          <div className="mb-4">
            <input
              type="number"
              min="0"
              placeholder="存款数量"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              className="border px-2 py-1 rounded mr-2"
            />
            <button
              onClick={handleApproveAndDeposit}
              disabled={loading || !depositAmount}
              className="px-3 py-1 bg-green-600 text-white rounded mr-2"
            >
              传统approve+deposit
            </button>
            <button
              onClick={handlePermit2Deposit}
              disabled={loading || !depositAmount}
              className="px-3 py-1 bg-purple-600 text-white rounded"
            >
              permit2一键存款
            </button>
          </div>
          <div className="mb-4">
            <button
              onClick={handleWithdraw}
              disabled={loading}
              className="px-3 py-1 bg-yellow-500 text-white rounded"
            >
              提现
            </button>
          </div>
        </>
      )}
      {loading && <div className="text-blue-600">交易处理中...</div>}
      {txHash && <div className="text-green-600">最新交易哈希: <a href={`#`} className="underline">{txHash}</a></div>}
      {error && <div className="text-red-600">{error}</div>}
      <div className="mt-8 text-xs text-gray-500">
        合约地址：<br />
        MyToken: {MYTOKEN_ADDR}<br />
        tokenBank: {BANK_ADDR}<br />
        Permit2: {PERMIT2_ADDR}
      </div>
    </main>
  );
}
