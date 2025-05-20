# 链下计算链上验证 - TokenBank示例

这个项目演示了如何使用链下计算+链上验证的模式来优化智能合约的gas消耗。

## 项目结构

- `src/`
  - `token.sol`: 简单的ERC20代币实现
  - `tokenBank.sol`: 存款银行合约，使用单链表保持用户余额由大到小排序
- `test/`: 测试文件
- `script/`: 部署脚本

## 主要功能

1. 用户可以存入和取出ERC20代币
2. 合约维护一个按存款余额从大到小排序的链表
3. 可以获取存款金额最多的前N个用户

## 优化方法

通过链下计算+链上验证模式，我们将排序的计算逻辑放在了链下：

1. 客户端计算用户在有序链表中的正确位置
2. 将计算结果作为参数传给智能合约
3. 智能合约只验证位置是否正确，无需遍历链表

这种方式大大节省了gas消耗，尤其是在链表较长的情况下。

## 部署指南

### 安装依赖

确保已安装Foundry：

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 编译合约

```bash
forge build
```

### 运行测试

```bash
forge test
```

### 部署合约

设置部署私钥环境变量（请用自己的私钥替换）：

```bash
export PRIVATE_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

部署到测试网络（以Sepolia为例）：

```bash
forge script script/deployTokenAndTokenBank.s.sol --rpc-url https://sepolia.infura.io/v3/YOUR_INFURA_KEY --broadcast --verify
```

## 使用方法

1. 客户端调用链下函数计算用户在链表中的正确位置
2. 调用`deposit`函数存款，传入计算好的位置参数
3. 调用`withdraw`函数取款，传入计算好的位置参数
4. 调用`getTopDepositors`函数获取存款最多的前N个用户
