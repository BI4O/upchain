# 31 EOA和多签钱包

## EOA

- #### 私钥（private key）：

  - 找到一个安全的256位随机序列

- #### 公钥（public key）：

  - 用secp256k（椭圆曲线）处理私钥

- #### 地址（address）：

  - 用keccak256处理，取末尾40位（20字节）为**私钥**

> 这个过程只可以私钥=>公钥=>地址，反方向是没有办法实现的，这也保证安全；
>
> 一句话概括下就是：**私钥通过椭圆曲线生成公钥， 公钥通过哈希函数生成地址，这两个过程都是单向的。**

## 改进

因为256位数字实在难以记忆和存储，有了新提案

- ### BIP32

  - 根据一个随机数种植，通过**确定性分层**来得到n个私钥
  - 每个级别之间用斜杠 / 来表示，由主私钥衍生出的私钥起始以“m”打头。因此，第一个母密钥生成的子私钥是m/0。第一个公共钥匙是M/0。第一个子密钥的子密钥就是m/0/1，以此类推。

- ### BIP44

  - 给BIP33指定了包含5个预定义树状层级的结构，以及这些数字的深层含义：
    `m / purpose' / coin' / account' / change / address_index`
  - m是固定的
  - purpose也是固定=44
  - coin中，0代表btc，1代表btc测试链，60代表eth
  - account账户索引从0开始
  - change的
    - 0外部收款地址
    - 1内部地址
  - address_index，地址的索引

- ### BIP39

  - BIP说保存一个随机数种子，但是还是太麻烦
  - 用助记词（mnemonic，尼莫尼克）的方式，只需记住12或者24个单词

  ```js
  // 随机数种子
  090ABCB3A6e1400e9345bC60c78a8BE7
  // 助记词种子
  candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
  ```

  使用bip39来生成助记词

  ```js
  var bip39 = require('bip39')
  // 生成助记词
  var mnemonic = bip39.generateMnemonic()
  console.log(mnemonic)
  ```

## MPC私钥分片

- 将私钥分片，每个分片有不同的参与方保管，通过m/n分片聚合出私钥

```js
const crypto = require("crypto");

// 原始私钥
const privateKey = "super_secret_private_key";

// 创建分片
const share1 = crypto.createHash("sha256").update(privateKey + "share1").digest("hex");
const share2 = crypto.createHash("sha256").update(privateKey + "share2").digest("hex");
const share3 = crypto.createHash("sha256").update(privateKey + "share3").digest("hex");

// 签名函数：使用两个分片和消息生成一个“签名”
function mpcSign(shareA, shareB, message) {
  const combined = shareA + shareB + message;
  return crypto.createHash("sha256").update(combined).digest("hex");
}

// 验证函数：只有正确的两片才能验证签名成功
function verifyMpcSignature(shares, message, expectedSignature) {
  if (shares.length < 2) {
    console.log("❌ 至少需要两个分片！");
    return false;
  }
  const generated = mpcSign(shares[0], shares[1], message);
  const isValid = generated === expectedSignature;
  console.log("✅ 验证结果：", isValid);
  return isValid;
}

// 要签的消息
const message = "Send 10 ETH to Alice";

// 用 share1 + share3 生成签名
const signature = mpcSign(share1, share3, message);
console.log("🎯 签名结果:", signature);

// 验证各种情况
console.log("\n--- 验证测试 ---");
verifyMpcSignature([share1], message, signature);            // false
verifyMpcSignature([share2], message, signature);            // false
verifyMpcSignature([share1, share2], message, signature);    // false
verifyMpcSignature([share1, share3], message, signature);    // true ✅
```

## 构造交易

- #### abi编码（注意跟abi描述不一样，描述是json）

  - 本质是：函数名+参数编码
  - abi前四个字节表示函数名
  - 如果有参数，后面第五位开始就是参数表示

- #### 交易信息

  ```json
  Transaction {
    to: Address // 交易的接收者
    nonce: Hex // 发送者的nonce(已发送交易数量的计数)
    type: Hex // 交易类型, 0(legcy) 或 1(EIP-2930) 或 2(EIP-1559)
    value: Hex // 交易携带的主币数量, 单位是 wei
    data: Hex // 交易携带的数据 (ABI 编码)
    maxPriorityFeePerGas?: Hex // EIP-1559:每单位 gas 优先费用, type=2时提供
    maxFeePerGas?: Hex // EIP-1559:每单位 gas 最大费用, type=2时提供
    gas: Hex // 可使用的最大 gas 数量(gasLimit)
  }
  ```

- 序列化、hash、签名

- 广播、节点验证、上链

## 用Viem模拟

1. 创建一个账号（随机助记词）
   1. 用viem在sepolia中检查钱包余额
   2. 给钱包里面转一点eth
2. 构造交易对象（erc20token转账的EIP1559交易）
   1. {to, data, value, gas, nonce}
3. 用新账号对交易签名
4. 发送到sepolia测试网确认

```js
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// 助记词生成
```

