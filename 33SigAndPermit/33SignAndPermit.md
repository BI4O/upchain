# 33 签名和批准

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