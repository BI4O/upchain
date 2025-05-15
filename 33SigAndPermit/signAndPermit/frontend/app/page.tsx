"use client";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract } from "wagmi";
import tokenBankAbi from "../abis/tokenBank.json";
import myTokenAbi from "../abis/MyToken.json";
import { parseEther } from "viem";

const TOKEN_BANK_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const MY_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // 查询MyToken余额
  const { data: myTokenBalance } = useReadContract({
    address: MY_TOKEN_ADDRESS,
    abi: myTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // 查询tokenBank余额
  const { data: bankBalance } = useReadContract({
    address: TOKEN_BANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // 存款金额
  const [amount, setAmount] = useState("");
  // permit相关参数
  const [deadline, setDeadline] = useState(0);
  const [permitSig, setPermitSig] = useState<{v:number;r:string;s:string}|null>(null);
  const [isPermitLoading, setIsPermitLoading] = useState(false);

  // 合约写操作
  const { writeContract, isPending: isWritePending } = useWriteContract();

  // 生成permit签名
  async function signPermit() {
    if (!(typeof window !== 'undefined' && (window as any).ethereum) || !address || !amount) return;
    setIsPermitLoading(true);
    try {
      // 获取nonce
      // 这里建议用viem或ethers获取nonce和domain，简化演示略去
      // 生成deadline
      const deadlineVal = Math.floor(Date.now() / 1000) + 3600;
      setDeadline(deadlineVal);
      // 构造permit数据结构
      // 这里建议用viem的signTypedData，实际项目请完善domain和types
      // 假设你有viem的signTypedData函数
      // const signature = await signTypedData({ ... });
      // 这里用伪代码
      // const { v, r, s } = parseSignature(signature);
      // setPermitSig({ v, r, s });
      alert("请在实际项目中用viem的signTypedData生成permit签名");
    } catch (e) {
      alert("签名失败: " + e);
    }
    setIsPermitLoading(false);
  }

  return (
    <main className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow flex flex-col gap-6">
      <h1 className="text-2xl font-bold mb-2">TokenBank 存款演示</h1>
      {!isConnected ? (
        <div className="flex flex-col gap-2">
          {connectors.map((connector) => (
            <button key={connector.id} className="btn btn-primary" onClick={() => connect({ connector })}>{connector.name}</button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <span>钱包地址: {address}</span>
            <button className="btn btn-sm" onClick={() => disconnect()}>断开</button>
          </div>
          <div className="flex flex-col gap-2">
            <div>MyToken余额: {myTokenBalance?.toString() ?? "-"}</div>
            <div>Bank余额: {bankBalance?.toString() ?? "-"}</div>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <input
              className="input input-bordered"
              placeholder="存款金额 (ETH)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                disabled={!amount || isWritePending}
                onClick={() => writeContract({
                  address: MY_TOKEN_ADDRESS,
                  abi: myTokenAbi,
                  functionName: "approve",
                  args: [TOKEN_BANK_ADDRESS, parseEther(amount)],
                })}
              >Approve</button>
              <button
                className="btn btn-primary"
                disabled={!amount || isWritePending}
                onClick={() => writeContract({
                  address: TOKEN_BANK_ADDRESS,
                  abi: tokenBankAbi,
                  functionName: "deposit",
                  args: [parseEther(amount)],
                })}
              >Deposit</button>
            </div>
            <div className="divider">或</div>
            <button className="btn btn-secondary" disabled={isPermitLoading} onClick={signPermit}>生成Permit签名</button>
            <button
              className="btn btn-primary"
              disabled={!permitSig || !amount || isWritePending}
              onClick={() => writeContract({
                address: TOKEN_BANK_ADDRESS,
                abi: tokenBankAbi,
                functionName: "depositWithPermit",
                args: [address, parseEther(amount), deadline, permitSig?.v, permitSig?.r, permitSig?.s],
              })}
            >Permit+Deposit</button>
          </div>
        </>
      )}
    </main>
  );
}
