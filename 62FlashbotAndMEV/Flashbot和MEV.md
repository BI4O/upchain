# 62 FlashBot和MEV

## mempool 内存池

- 交易打包之前，所有的交易会提交到mempool内存池
- 每个节点都有自己的内存池
- 节点之间会广播内存池里面的交易
- 用户可以监听内存池里面的pending tx

## MEV 最大可提取收益

Maximal(Miner) Extractable Value 最大可提取价值，指的是矿工通过交易对排序来踢去最大可能的收益（除了手续费以外的贿赂费）

#### 主要策略/类型

1. front-run：抢跑，利用未确认交易的信息，提前进行相同交易以获取利润
2. back-run：尾随交易，紧接在一个未确认的目标后面交易
3. sandwich attack：三明治攻击，在目标交易前后插入自己的交易，以操纵市场价格获取利润
4. arbitrary：套利，利用不同交易所之间的价格差异，进行快速买卖以获取差价
5. liquidation：清算，因为借贷平台为了控制风险，会有清算奖励，比如compound是8%，所以可以通过帮借贷平台清算来获取收益
6. 矿池提取：在dex中，操纵流动性池中的交易顺序，获取收益

> 为什么是以太坊是黑暗森林？因为只要合理地利用规则，就可以获取收益，但是一旦你的获益策略被暴露，你也可能会被攻击，就像丛林法则一样螳螂捕蝉黄雀在后

#### mev现象的好处

- 帮助defi协议抹除价差
- 提升验证者收益

#### mev现象的弊端

- gas费战争和gas不稳定
- 对普通交易者不公平
- 导致更多的失败交易浪费链上空间

## FlashBot

致力于透明化、民主化、排序权和出块权分离的，研究环节以太坊MEV的组织。

之前排序和出块都是validator来做，现在validator可以出售自己的排序权给builders们，自己只收取builder排序好之后给的承诺收益

##### 新的排序+打包过程

1. searcher（套利者）找到有力可图的bundle，也就是一批交易包装成的tx
2. 各个builders节点（注意他不是普通用户）自己运营一套将mempool里面的tx/bundle按某个顺序打包能达到的最大利润，来提交给validator，但是提交之前先去relay做一次加密
3. 提交给relay节点之后，为了防止validator作恶，relay会将某个builder给出的最优排序法里面的tx内容做加密，只告诉validator这个排序法能得xxx利益，属于最有利可图的排序
4. validator收到relay节点加密完成的排序法之后，没法知道里面的tx的具体内容，只能根据给的relay给的最优排序法行使打包权，并获得builder承诺的xxx利益，至于builder本身通过排序获得的收益，validator无法得知

#### 主要产品

MEV-Boost：开源中间件，将区块构造工作外包给第三方builder

builderNet/rbuilder：构建者开源实现及网络

Flashbot Protect：提供一个隐私借贷呢，帮助用户避免抢跑和三明治攻击

#### 主要功能（对套利者/普通用户来说）

通过一个交易排序市场，支持：

1. 发送隐私交易
2. 发送多个交易
3. 指定交易顺序
4. 实行成交区块/时间
5. 撤回失败交易

对于用户来说，实现这些交易就是用那几个builder的RPC节点来发送交易，目前看etherscan已经看到被这三家builder几乎垄断了，你不用他们的rpc很难上链

- Titan Builder
- beaverbuild
- rsync-builder.eth

这三家一共占了87%的交易，第一名泰坦就占了44%（截至2025年6月[链接](www.rated.network/builders))

## FlashBot案例

比如有一个NFT市场的代码已经开源的，你看到有一个开启预售的函数开关

```solidity
contract OpenspaceNFT is ERC721 {
bool public isPresaleActive = true;
	// 售卖函数
    function presale(uint256 amount) payable{
        require(isPresaleActive, "Presale is not active");
        require(amount* 0.01 ether==msg.value, "Invalid amount");
        require(amount+totalSupply()<=1024, "Not enough tokens left”);
        _mint(msg.sender, amount);
    }
	
	// 开售开关
    function enablePresale() public onlyOwner {
        isPresaleActive = true;
    }
}
```

链下做一个脚本，做捆绑交易

##### simply.py

```python
# 1. 加载合约
with open("presailNFT.json", "r") as f:
    NFT_ABI = json.load(f)
NFT_CONTRACT_ADDRESS = "0x4c1598aC47B10958aA3a6Bf5556a383486Bb9de7"
nft_contract = w3.eth.contract(address=NFT_CONTRACT_ADDRESS, abi=NFT_ABI)

# 2. 监听 presale 状态
while True:
    is_active = nft_contract.functions.isPresaleActive().call()
    if is_active:
        logger.info("预售已开启，立即抢购！")
        break
    else:
        logger.info("预售未开启，等待中...")
    time.sleep(1)

# 3. 构造 presale(1) 交易
nonce = w3.eth.get_transaction_count(sender.address)
presale_tx = nft_contract.functions.presale(1).build_transaction({
    "from": sender.address,
    "value": w3.to_wei(0.05, "ether"),
    "nonce": nonce,
    "gas": 300_000,
    "maxFeePerGas": w3.to_wei(3, "gwei"),
    "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
    "chainId": w3.eth.chain_id,
})
signed_presale_tx = w3.eth.account.sign_transaction(presale_tx, private_key=sender.key)

bundle = [
    {"signed_transaction": signed_presale_tx.rawTransaction}
]

# 尝试发送 bundle
max_attempts = 3
for attempt in range(max_attempts):
    try:
        current_block = w3.eth.block_number
        target_block = current_block + 1
        replacement_uuid = str(uuid4())
        logger.info(f"第{attempt + 1}次尝试，目标区块：{target_block}，发送抢购交易...")
        send_result = w3.flashbots.send_bundle(
            bundle,
            target_block_number=target_block,
            opts={"replacementUuid": replacement_uuid},
        )
        try:
            send_result.wait()
            receipts = send_result.receipts()
            logger.info(f"抢购成功！交易已打包进区块 {receipts[0].blockNumber}")
            return
        except TransactionNotFound:
            logger.warning(f"本轮未抢到，区块 {target_block} 未包含交易。")
```

