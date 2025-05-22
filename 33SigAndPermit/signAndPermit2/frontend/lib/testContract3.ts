import { publicActions, http, createWalletClient, parseEther, getContract, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import MyTokenABI from '../abis/MyToken.json';
import TokenBankABI from '../abis/tokenBank.json';
import Permit2ABI from '../abis/Permit2.json';

// 账户
const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(privateKey);

// 创建钱包客户端
export const client = createWalletClient({
  chain: foundry,
  transport: http("http://localhost:8545")
}).extend(publicActions);

// 合约地址
const tokenAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address;
const bankAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as Address;
const permit2Address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as Address;

// 初始化合约实例
const token = getContract({
  address: tokenAddress,
  abi: MyTokenABI,
  client: client,
});
const bank = getContract({
  address: bankAddress,
  abi: TokenBankABI,
  client: client,
});
const permit2 = getContract({
  address: permit2Address,
  abi: Permit2ABI,
  client: client,
});

function replacer(_key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

async function main() {
  console.log("------Permit2 存款测试开始------");
  console.log(`账户地址: ${account.address}`);

  // 查询余额
  const balance = await token.read.balanceOf([account.address]);
  const bankBalance = await bank.read.balanceOf([account.address]);
  console.log(`当前代币余额: ${balance}`);
  console.log(`当前银行余额: ${bankBalance}`);

  // 1. approve最大额度给Permit2
  const max = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  const allowance = await token.read.allowance([account.address, permit2Address]);
  if (BigInt(allowance as string) < max) {
    const approveTx = await token.write.approve([
      permit2Address,
      max
    ], {
      account: account
    });
    console.log(`授权Permit2最大额度，交易哈希: ${approveTx}`);
  } else {
    console.log("已授权Permit2最大额度");
  }

  // 查询 allowance 顺序 nonce（仅打印，流程不变）
  const allowanceRes = await permit2.read.allowance([
    account.address, // owner
    tokenAddress,    // token
    bankAddress      // spender
  ]) as [string, string, string];
  const allowanceAmount = BigInt(allowanceRes[0]);
  const allowanceExpiration = BigInt(allowanceRes[1]);
  const allowanceNonce = Number(allowanceRes[2]);
  console.log("AllowanceTransfer 顺序 nonce:", allowanceNonce);

  // 2. 构造permit2 EIP-712签名
  const depositAmount = parseEther("10");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  // 查询 permit2 bitmap，自动分配未用的 nonce
  const wordPos = 0; // 一般用0
  const bitmap = BigInt(await permit2.read.nonceBitmap([account.address, wordPos]) as string);
  let nonce = 0;
  while ((bitmap & (BigInt(1) << BigInt(nonce))) !== BigInt(0)) {
    nonce++;
  }
  console.log("本次使用的 nonce:", nonce);
  const chainId = await client.getChainId();

  // EIP-712结构体
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
      token: tokenAddress,
      amount: depositAmount,
    },
    nonce: BigInt(nonce),
    deadline: deadline,
  };
  const domain = {
    name: "Permit2",
    chainId: chainId,
    verifyingContract: permit2Address,
  };
  console.log("EIP-712签名域:", domain);
  console.log("EIP-712消息:", value);

  // 3. 签名
  const signature = await client.signTypedData({
    account: account,
    domain: domain,
    types: types,
    primaryType: "PermitTransferFrom",
    message: value,
  });
  console.log("签名:", signature);

  // 4. 调用depositWithPermit2
  try {
    const depositTx = await bank.write.depositWithPermit2([
      account.address,
      depositAmount,
      deadline,
      signature
    ], {
      account: account
    });
    console.log("depositWithPermit2交易哈希:", depositTx);
  } catch (e) {
    console.error("depositWithPermit2失败:", e);
  }

  // 查询余额
  const balanceAfter = await token.read.balanceOf([account.address]);
  const bankBalanceAfter = await bank.read.balanceOf([account.address]);
  console.log(`存款后代币余额: ${balanceAfter}`);
  console.log(`存款后银行余额: ${bankBalanceAfter}`);
}

main().catch(console.error); 