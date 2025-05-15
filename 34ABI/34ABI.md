# 34 ABI

## ABI和编码

- ABI是“应用程序二进制接口”，是EVM和智能合约交互的标准，包含描述和编码
- 描述是json，方便人类阅读，以及其他合约与本合约交互
- 编码是16进制数字，EVM阅读的字节码
- 默认我们说的“ABI”就是ABI描述的json

#### ABI生成

ABI是编译的产物，所以编译就可以生成

- `forge buold Counter.sol` 
  - 在`out/Counter.sol/Counter.json`就包含了ABI
- `forge inspect Counter abi --json > Counter.json` 
  - 通过inspect在想要的目录生成ABI描述

#### ABI结构

- type
- name
- inputs
- outputs
- stateMutability

#### 编码一、函数编码/选择器（selector）

对于一个函数签名，通过一步的hash就可一得到他的hex编码（32字节-64个16进制符号），然后再取前4字节（8个16进制符号）来作为函数的编码表示，也叫**Selector**

##### 用cast模拟hash的过程

1. 完整32字节

```cmd
> cast keccak "setNumber(uint256)"
> 0x3fb5c1cb9d57cc981b075ac270f9215e697bc33dacd5ce87319656ebf8fc7b92
```

2. 拿4个字节的Selector

```cmd
> cast sig "setNumber(uint256)"
> 0x3fb5c1cb
```

> 因为截取的是前四个字节，所以很多函数的selector很有可能重复用同一个selector，

#### 编码二、函数参数

从第4个字节（8个16进制符号）往后，就都是函数参数

参数分两种：静态类型和动态类型

- 静态类型（1*32个字节表示）

```cmd
> cast abi-encode "setNumber(uint256)" 123
> 0x000000000000000000000000000000000000000000000000000000000000007b
```

- 静态类型（3*32个字节表示），string/bytes/any[]
  - 起始位置
  - 数据大小
  - 真实数据

```cmd
> cast abi-encode "setString(string)" abc
> 0x000000000000000000000000000000000000000000000000000000000000002\
00000000000000000000000000000000000000000000000000000000000000003\
6162630000000000000000000000000000000000000000000000000000000000
```

> 如果你想看一个签名比如“setNumber(uint256)”+参数的完整编码（函数名hash取前4+参数abi编码），可以用`cast calldata` + 签名
>
> ```cmd
> > cast calldata "setNumber(uint256)" 123
> > 0x3fb5c1cb000000000000000000000000000000000000000000000000000000000000007b
> ```

#### 编码三、事件

在看etherscan的时候，看`logs`可以看到这个合约的事件抛出的参数，直接关注`Topics`项和`Data`项

- `Topics[0]`：表示事件的签名的编码，是一个32字节的hash值，可以用命令模拟

```cmd
> cast sig-event "Transfer(address from ...)"
```

- `Topics[1]`到`Topics[n]`就看事件有多少个indexed参数了，最多3个，也是用一个32字节的ABI编码值表示
- `Data`就是剩下的所有的没有indexed的参数，直接按顺序ABI编码成16进制之后拼接在一起

> 匿名事件：如果一个事件是`anonymous`，那么他的所有`Topics`都是indexed的参数的hash，没有事件签名的hash

#### 🧠 编码总结：hash和ABI？

| 内容                  | 示例                                | 是否哈希    | 是否 ABI 编码      | 能否反推 | 备注                  |
| --------------------- | ----------------------------------- | ----------- | ------------------ | -------- | --------------------- |
| 函数名 + 参数类型     | `transfer(address,uint256)`         | ✅ keccak256 | ❌                  | ❌        | 取前4字节做函数选择器 |
| event 签名            | `Transfer(address,address,uint256)` | ✅ keccak256 | ❌                  | ❌        | topic[0]              |
| indexed event 参数    | `from`, `to`                        | ❌           | ✅ 单个 abi.encode  | ✅        | topic[1], topic[2]    |
| 非 indexed event 参数 | `value`                             | ❌           | ✅ abi.encodePacked | ✅        | 放在 data 中          |
| 函数参数值            | `123`                               | ❌           | ✅                  | ✅        | 可 decode             |
| constructor 参数      | 见上                                | ❌           | ✅                  | ✅        | 追加在部署字节码后面  |

## 🎯 结论关键词：

- **函数/事件签名会被 keccak256 哈希，不能反推（但能在https://www.4byte.directory/查表）**
- **具体的参数值则是 ABI 编码，是可以 decode 的**
- **Event 的 indexed 参数放在 topics 中，但可以解码**
- **data 里的东西是重点分析对象，常能看懂“意图”**

> 逆向分析交易（比如没有event帮忙的时候）：
>
> ```cmd
> 0xa9059cbb0000000000000000000000005494befe3ce72a2ca0001fe0ed0c55b42f8c358f000000000000000000000000000000000000000000000000000000000836d54c
> ```
>
> 通过`0xa9059c`的hash值查表知道是`transfer(address,uint256)`
>
> 然后把整个calldata给decode
>
> ```cmd
> > cast calldata-decode "transfer(address,uint256)" 0xa9059cbb0000000000000000000000005494befe3ce72a2ca0001fe0ed0c55b42f8c358f000000000000000000000000000000000000000000000000000000000836d54c
> > 0x5494befe3CE72A2CA0001fE0Ed0C55B42F8c358f
> 137811276 [1.378e8]
> ```
>
> - 地址`0x5494befe3CE72A2CA0001fE0Ed0C55B42F8c358f`
> - 转账金额`137811276`

## 监听链上数据

##### 目前方法是订阅和扫块

## 订阅subscription

用Viem来监听标准的ERC20的transfer的事件

- 确保anvil已经启动，合约已经部署在上面
- 新建一个文件夹，`pnpm install viem tsx`

##### subscription.ts

```ts
import {createPublicClient, http, parseAbi} from "viem";
import {foundry} from "viem/chains";

const tokenAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
const transferEvent = parseAbi([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
])

// handler
const client = createPublicClient({
    chain: foundry,
    transport: http("http://localhost:8545")
});

// watch
console.log("开始监听MyToke交易事件...");
client.watchEvent({
    address: tokenAddr,
    event: transferEvent[0],
    onLogs: (logs) => {
        for (const log of logs) {
            const from = log.args.from;
            const to = log.args.to;
            const value = log.args.value;
            console.log(`交易金额：${value}\nfrom:${from}\nto:${to}`);
        }
    }
})
```

命令行：`tsx subcription.ts `

在Remix中启动在anvil网络的转账，就会在命令行看到如下：

<pre>bi4o@Macbi4o listenBlockChain % tsx subcription.ts
开始监听MyToke交易事件...
交易金额：998
from:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
to:0x70997970C51812dc3A010C7d01b50e0d17dc79C8</pre>

#### 缺点

- 网络问题，可能订阅会断开，可能错过一些事件
- 启动之后只能监听之后的新事件
- 性能开销大，如果你在watchEvent中加更多筛选的逻辑，本质上需要RPC服务器帮你筛选，所以慢，可能RPC服务商也会有限制

## 扫块block scaning

扫块就是对已经上了块的所有信息获取，本质上获取的信息更原生，但是因为没有经过筛选，其实更准确和可靠，不会像订阅一样收到网络问题的影响漏掉一些信息。

本质是通过RPC 用纯EVM命令来获取信息

- 区块：eth_getBlockByHash, etc_getBlockNumber
- 交易：eth_getTransactionByHash
- 交易收据：eth_getTransactionReceipt
- 交易日志：eth_getLogs

以上这些`viem`都可以模拟调

#### client.getLogs()

- 指定区块范围

```ts
// 一般会加区块的条件
const logs = await publicClient.getLogs({
    fromBlock: 16330000n,
    toBlock: 16330050n
})
```

- 指定合约地址、事件、事件参数

```ts
const logs = await publicClient.getLogs({
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    event: parseAbi([
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]),
    args: {
    from: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    to: '0xa5cc3c03994db5b0d9a5eedd10cabab0813678ac'
    },
    fromBlock: 16330000n,
    toBlock: 16330050n
})
```

> `parseAbiItem(string)`只可以指定一个事件，而`parseAbi(string[])`可以指定一堆事件
>
> args参数是指indexed的参数