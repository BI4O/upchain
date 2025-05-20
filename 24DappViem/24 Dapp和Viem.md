# 24 Dapp和Viem

## 应用架构

- 用户和区块链之间，有几个要素实现读写数据
  - 前端
    - 实时数据（向链要）
    - 历史数据（向后端接口/数据平台要）：比如近期的log
    - 写数据（向链写入）
  - 后端（本地数据库）
    - 提供接口（给前端）：近期的log
    - 索引数据（向链要）：比如久远的log
  - 数据平台（第三方）
    - API（给前端）：啥都有
    - 索引数据（向链要）：

## 交易的本质

<pre style="background-color: whitesmoke">
{
 "from"   : "",
 "to"     : "0x0123",
 "value"  : 0,
 "data"   : "0xabcdef"
}  
</pre>

- from：msg.sender，有时候是空，比如创建合约
- to：给谁发
- value：附带多少以太币
- data：做什么，用`abi.encodeSignature()`生成的
  - selector
  - param1
  - ...

交易是通过网络请求https或者websocket发起，其实就是发送了一串json数据给到脸上，然后获得链上的json回应，整个过程要用RPC来保证通信。

## Viem

#### 安装

`pnpm install viem`

#### 选定网络

```ts
import {foundry,sepolis,mainnet} from 'viem/chains';
```

#### 创建对象

```ts
import {
  createPublicClient, 
  createWalletClient, 
  http,
	custom,
} from 'viem';

// 一、公共对象，用来调用区块链公共变量如blockNumber
const publicClient = createPublicClient({
  chain: foundry,
  transport: http(),
});

// 二、钱包对象，用来跟合约交互，因为要有msg.sender
const walletClient = createWalletClient({
  chain: foundry,
  transport: custom(window.ethereum),
});
```

#### 合约交互

```ts
import {getContract} from 'viem';
import COunter_ABI from 'path/to/counter.json'; // abi文件

...
const COUNTER_ADDRESS = "0x7148E9A2d539A99a66f1bd591E4E20cA35a08eD5";

// 合约view，不需要account
const counterContract = getContract({
  address: COUNTER_ADDRESS,
  abi: Counter_ABI,
  client: publicClient,
});

const number = await counterContract.read.number();

// 合约write，需要account也就是msg.sender
const hash = await walletClient.writeContract({
  address: COUNTER_ADDRESS,
  abi: Counter_ABI,
  functionName: 'increment',
  account: address,
});
console.log('Transaction hash:', hash);
```



