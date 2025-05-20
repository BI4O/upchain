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

## 多签钱包实践一（常用）

### https://app.safe.global/

一个比较好的轮子，实现了多签钱包的实现，可以创建一个多签钱包（本质是一个合约）

- 可以新建一个钱包，并添加owner，然后设置这个多签钱包（合约）的所有tx都需要比如三个人中的两个人来签名，才可以交易
- 钱包创建好之后可以发起tx，从钱包中转取出钱也是一个比较常见的tx，需要比如说2/3的来签名，然后才可以执行
- 这个钱包还可以当成是一个msg.sender去和别的合约交互，同样的，所有的交互都是需要比如说2/3的签名，才可以执行。
  - 需要声明要交互的合约的地址，ABI，以及要交互的函数签名

## 多签钱包实践二（自己写）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract MutiSigWalletSimple {
    address[] public owners;   // 签名者
    mapping(address => bool) public isOwner;  // 是否签名者
    uint public required = 2;  // 通过票数

    // 交易
    struct Tx {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint confirmations; //  同意的数量
    }

    // 根据id找到交易对象
    Tx[] public txLine; // 交易队列
    // 提议id
    uint public _nextTxId = 0; 
    // 根据id找到owner是否已经批准
    mapping(uint => mapping(address => bool)) public isApproved; //

    constructor(address _o1, address _o2, address _o3) {
        // register all owners
        owners = [_o1, _o2, _o3];
        required = 2;
        // set owner idendifier
        for (uint256 index = 0; index < owners.length; index++) {
            isOwner[owners[index]] = true;
        }
    }

    receive() external payable {}

    // 提交提案
    function submitTx(address _to, uint _value, bytes calldata _data) external {
        // 必须是owners之一才可以发起
        require(isOwner[msg.sender], "Must submit by one of owners!");
        // 加入提议
        txLine.push(
            Tx({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                confirmations: 0
            })
        );  
        // 记录提议者对提案的准许
        txLine[_nextTxId].confirmations += 1;
        isApproved[_nextTxId][msg.sender] = true;
        // 第一个tx是0，后面是逐步递增，刚好根据id获取
        _nextTxId += 1;
    }

    // 同意提案
    function approveTx(uint _txId) public {
        require(_txId < _nextTxId, "Tx not exists!");
        require(isOwner[msg.sender], "You are not one of owners");
        require(isApproved[_txId][msg.sender] == false, "You already approved this tx");

        // 记录谁准许了
        isApproved[_txId][msg.sender] = true;
        // 记录提案准许+1
        txLine[_txId].confirmations += 1;
    }

    // 执行提案
    function executeTx(uint _txId) public {
        // 所有人都可以执行
        require(_txId < _nextTxId, "Tx not exists!");
        Tx storage etx = txLine[_txId];
        require(etx.confirmations >= required, "Tx not enough comfirmations!");
        require(etx.executed != true, "Tx already excuted!");

        // 正式执行
        (bool ok,) = etx.to.call{value: etx.value}(etx.data);
        require(ok, "Tx failed when excuted!");
        etx.executed = true;
    }
}
```

