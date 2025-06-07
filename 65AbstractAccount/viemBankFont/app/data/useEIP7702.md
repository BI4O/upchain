# EIP-7702 批量交易经典案例教程

本教程将带你一步一步理解并实践如何用 EIP-7702 实现批量交易，基于 `app/data/useEIP7702.ts` 的代码。适合初学者。

---

## 1. 背景知识

EIP-7702 允许以太坊账户临时变为智能合约账户，实现如批量操作、授权等高级功能。这个案例演示如何：
- 批量授权并存款到 Bank 合约
- 查询余额
- 取消授权

---

## 2. 环境准备

1. **安装依赖**（已用 pnpm）：
   ```bash
   pnpm install
   ```
2. **配置环境变量**（`.env` 文件）：
   ```env
   SEPOLIA_PRIVATE_KEY=你的私钥
   SEPOLIA_RPC_URL=你的Sepolia节点RPC
   DELEGATE_CONTRACT_ADDRESS=SimpleDelegate合约地址
   TOKEN_CONTRACT_ADDRESS=ERC20合约地址
   TOKEN_BANK_CONTRACT_ADDRESS=Bank合约地址
   ```

---

## 3. 主要依赖与合约

- [viem](https://viem.sh/)：现代以太坊JS库
- SimpleDelegate 合约：支持批量调用
- ERC20 合约：标准代币
- TokenBank 合约：存款合约

---

## 4. 步骤详解

### 步骤 1：初始化账户与客户端

```ts
const eoa = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL!) });
const walletClient = createWalletClient({ account: eoa, chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL!) });
```
- 通过私钥创建 EOA 账户
- 创建公有和钱包客户端，连接到 Sepolia 测试网

---

### 步骤 2：构造批量操作 calldata

```ts
const approveCalldata = encodeFunctionData({
  abi: ERC20Abi,
  functionName: 'approve',
  args: [TOKENBANK_ADDRESS, DEPOSIT_AMOUNT],
});
const depositCalldata = encodeFunctionData({
  abi: TokenBankAbi,
  functionName: 'deposit',
  args: [DEPOSIT_AMOUNT],
});
```
- 先授权 Bank 合约可以转账
- 再调用 Bank 合约的存款方法

---

### 步骤 3：批量打包 calls

```ts
const calls = [
  { to: ERC20_ADDRESS, data: approveCalldata, value: 0n },
  { to: TOKENBANK_ADDRESS, data: depositCalldata, value: 0n },
];
```
- 把两步操作打包成一个数组，准备批量执行

---

### 步骤 4：构造 execute calldata

```ts
const executeCalldata = encodeFunctionData({
  abi: SimpleDelegateAbi,
  functionName: 'execute',
  args: [calls],
});
```
- 用 SimpleDelegate 合约的 `execute` 方法批量执行 calls

---

### 步骤 5：查询余额和链上代码

```ts
await getTokenBalance(eoa.address, publicClient, walletClient);
const code = await getCodeAtAddress(eoa.address, publicClient);
```
- 查询当前账户的 ERC20 余额
- 查询账户是否已变为合约（有无代码）

---

### 步骤 6：发送批量交易

- **如果账户已是合约**：直接 sendTransaction
- **如果账户是普通 EOA**：先用 EIP-7702 授权，再批量操作

```ts
if (typeof code === 'string' && code.length > 0) {
  // 已是合约账户
  const hash = await walletClient.sendTransaction({ to: eoa.address, data: executeCalldata });
  // ...
} else {
  // 先签授权
  const authorization = await walletClient.signAuthorization({ contractAddress: SIMPLE_DELEGATE_ADDRESS, executor: 'self' });
  // 用 EIP-7702 批量交易
  const hash = await walletClient.writeContract({
    abi: SimpleDelegateAbi,
    address: eoa.address,
    functionName: 'execute',
    args: [calls],
    authorizationList: [authorization],
  });
  // ...
}
```
- 这样可以让普通账户临时拥有合约能力，完成批量操作

---

### 步骤 7：查询 Bank 合约和账户余额

```ts
await getTokenBalance(TOKENBANK_ADDRESS, publicClient, walletClient);
await getTokenBalance(eoa.address, publicClient, walletClient);
```
- 检查存款是否到账

---

### 步骤 8：取消授权

```ts
const cancelAuthorization = await walletClient.signAuthorization({ contractAddress: zeroAddress, executor: 'self' });
const cancelHash = await walletClient.sendTransaction({ authorizationList: [cancelAuthorization], to: zeroAddress });
```
- 取消 EIP-7702 授权，账户恢复普通状态

---

## 5. 总结

本案例完整演示了 EIP-7702 的典型用法：
- 如何批量授权和操作
- 如何让 EOA 临时变为合约账户
- 如何恢复普通账户

你可以根据本教程和 `useEIP7702.ts` 代码，快速上手 EIP-7702 批量交易开发。

---

如有疑问，欢迎随时提问！ 