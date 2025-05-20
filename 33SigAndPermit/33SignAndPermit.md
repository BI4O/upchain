# 33 签名和批准

## 合约中验证签名

#### 什么是签名？

比如有一个消息`hello world`

1. 首先经过EIP191/EIP712做翻译，变成bytes（不定长）
2. 然后用`keccak256`做hash加密，变成hashData（固定成32bytes）
3. 最后用私钥把这个hashData做签名，生成signature（65bytes）

#### 签名什么用？

1. 签名动作是线下完成的，用viem和你提供的私钥就可以得到，不需要gas
2. 这个签名和原文可以拿去给合约验证，如果验证结果出来的地址就是你的地址
3. 就说明这个签名就是用你的私钥对这个原文签出来的（平时就是metamask弹窗之后你点确认的过程）
4. 就相当于你承认了你同意了这个无论是授权也好转账也好的提议
5. 假如你同意了“A从你的银行账户拿你10块”，A拿着你的签名数据去找银行，银行验证后就可以执行，无需你再去银行approve
6. 所以不要随便签名！！可能导致资金损失！！

### EIP191

规定了对字符串怎么进行签名的规范

### EIP712

规定了对结构体数据怎么进行签名的规范

因为结构体本身是可以包含任意类型的数据的，所以自然就能包含EIP191的使用范围，下面模拟一下EIP712实现

## EIP712-前端签名+合约验证

首先既然是结构化数据，按照规范包含3个部分，如果用支票来比喻

- domain：支票头
  - chainId：去哪个银行？
  - name：去什么业务台？
  - verifyingContract：具体找哪个经理验证？
  - version：支票版本，一般默认1.0.0
- type：支票项目
  - 一般都是自定义的，一般第一层就一个key
- message：支票项目上的具体数字
  - 跟随value

```solidity
// 合约
contract verifier is EIP712 {
    using ECDSA for bytes32;

    struct Send {
        address to;
        uint value;
        string info;
    }

    // ！注意！不可以在逗号后面加空格，否则对不上了
    bytes32 public constant SEND_TYPEHASH = keccak256("Send(address to,uint256 value,string info)");

    constructor() EIP712("EIP712test","1.0.0") {}

    // 加密原文
    function hashSend(Send memory send) public view returns(bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            SEND_TYPEHASH,
            send.to,
            send.value,
            keccak256(bytes(send.info)) // 为了保持都是32字节
        )));
    }

    // 比对签名，还原签名者地址
    function verify(
        address signer, 
        Send memory send, 
        bytes memory signature
    ) public view returns(bool){

        // 模拟未署名的结构化数据
        bytes32 digest = hashSend(send);

        // 跟已经署名的结构化数据比对，获得签名人地址
        return digest.recover(signature) == signer;
    }

    // 执行
    function execute(
        address signer,
        address to,
        uint value,
        string calldata info,
        bytes calldata signature
    ) public view returns(bool){
        Send memory send = Send({to: to, value: value, info: info});
        require(verify(signer, send, signature), "Invalid signature!");

        // 验证通过后要进行的逻辑
        return true;
    }
}
```

前端

```ts
// 前端用viem生成签名过程
const domain = {
  chainId: 31337,
  name: "EIP712test",
  verifyContract: CONTRACT_ADDRESS,
  version: "1.0.0"
};
const types = {
  Send: {
    {name: "to", type: "address"},
  	{name: "value", type: "uint256"},
    {name: "info", type: "string"}
  } 
};
const message {
  to: toAddress as Address,
  value: parseEther(amount)
}

// viem生成签名
const signature = await walletClient.signTypedData({
  account, // signer
  domain,types,massage, // 三要素
  primaryType: "Send"   // 生成签名要用
})

// 然后调用合约的验证和执行
const contract = getContract({
  address: contractAddress,
  abi: CONTRACT_ABI,
  client: publicClient,
});

const result = await contract.read.execute([signer, user, discount, info, signature]);

```



## ERC20-授权

之前做过的案例要实现在银行存erc20的token，EOA必须要在token合约中：

1. erc20token.approve(bankAddr, amount)：批准银行从我这里的拿走一定数量的token
2. erc20token.transferFrom(msg.sender, bankAddr, amount)：erc20合约正式记账，把token转移到银行的下

其实这个过程非场复杂，用户相当于要跟erc20合约做两次签名，告诉他“我先批准，然后你再把token记到银行地址下”

于是有没有新的方式，可以让我一个签名就完成两件事呢？比如在transferFrom中附带上我的bytes data签名数据，从而告诉erc20token说，我已经准许授权了，直接转账吧

`approve + tansferFrom    ->     signatures + transferFrom`

## ERC20-Permit

根据`EIP2621`提案，我们可以**签名授权**，而非**函数授权**

- 在`openzeppelin`中，这个提案的具体实现是用`ERC20Permit.sol`这个拓展，
- 在初始化`ERC20`的过程中，加上`ERC20Permit()`这个modifier就可以使得新建的token拥有新的函数