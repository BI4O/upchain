# 45 chainlink自动化

因为合约本身只能被动地调用，本身是不可以定时执行的，就像一个机器人一样，除非你写一个线下的ts或者python脚本

目前市面上也有一些自动化执行的方案，其实就是他们帮你执行

- chainlink automation
  - 按时间触发
  - 按条件
- gelato
- openZeppelin defender

### 使用方法

为了兼容，需要在自己的合约中有这两个方法

- `checkUpKeep()`：其实就是一个trigger，返回一个bool，告诉自动化程序是否自动化执行，而且一定要返回bool或者bool，
- `performKeep()`：这个方法就是当脚本checkupkeep=true的时候，就回触发的函数

```solidity
contract Counter is AutomationCompatibleInterface {
		uint public counter;
		uint public immutable interval; // 间隔时间
		uint public lastTimeStamp;
		
		event Perform(uint counter, bytes sth);
		constructor(uint updateInterval) {
        interval = updateInterval; // 确定间隔时间
        lastTimeStamp = block.timestamp; // 开始时间
        counter = 0; // 触发次数
		}
		
		function checkUpkeep(bytes calldata sth) external view returns(bool, bytes memory) {
        // 现在距离上一次触发间隔，够了最小间隔了没？
        // 够了就返回true
        bool ok = (block.timestamp - lastTimeStamp) > interval;
        return (ok, sth);
		}
	
		function performUpkeep(bytes calldata sth) external {
        // 还是建议在再执行一次检查
        if ((block.timestamp - lastTimeStamp) > interval) {
            lastTimeStamp = block.timestamp;
            counter += 1;
            emit Perform(counter, bytes(sth));
        }            
    }
}
  	
```

> [!note]
>
> 1. `interval`和`lastTimeStamp`是是必须要有的变量，否则chainlink不知道什么时候主动执行，除非你选了定时，只要选了自定义触发条件就必须有这两个
> 2. `checkUpKeep(bytes calldata)returns(bool,bytes memory)`，这个函数的接口就是固定死了的，不要自作聪明地省略bytes输入或者输出
> 3. `performUpkeep`也是固定要有一个bytes输入，你可以不用但是不要在函数中丢掉
> 4. 两个函数都不可以限制msg.sender是谁，否则也会调用不成功



## 实践作业

(自动化)tokenBank中，当某个人存款超过 x 时,转移一半的存款的到指定的地址,如用户。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// token
contract Token is ERC20 {
    address public owner;
    constructor() ERC20("AutoWithdraw","AT"){
        owner = msg.sender;
        _mint(owner, 1e10 ether);
    }
}

// bank
contract TokenBank {
    Token public token;
    mapping(address => uint) public balances;

    constructor(address tokenAddr) {
        token = Token(tokenAddr);
    }

    function deposit(uint _amount) public {
        require(token.allowance(msg.sender, address(this)) >= _amount, "bank unauthorized");
        require(token.balanceOf(msg.sender) >= _amount, "balance exceed");
        bool success = token.transferFrom(msg.sender, address(this), _amount);
        require(success, "transfer failed");
        balances[msg.sender] += _amount;
    }

    function withdraw() public {
        require(balances[msg.sender] > 0, "balance is empty");
        bool success = token.transfer(msg.sender, balances[msg.sender]);
        require(success, "withdraw failed");
        balances[msg.sender] = 0;
    }

    function excuateWithdraw(address user, uint amount) public {
        require(balances[user] > 0, "balance is empty");
        bool success = token.transfer(user, amount);
        require(success, "auto withdraw failed");
        balances[user] -= amount;
    }
}

// auto
contract autoWithdraw {
    Token private _token;
    TokenBank private _tokenBank;

    uint public widrawTimes;
    address public watchAddr;
    uint public threshold;

    uint256 public immutable interval;
    uint256 public lastTimeStamp;

    constructor(address tokenAddr, address tokenBankAddr) {
        _token = Token(tokenAddr);
        _tokenBank = TokenBank(tokenBankAddr);
        widrawTimes = 0;
        watchAddr = msg.sender; // 我的mm钱包
        threshold = 500;

        // chainlink automation 定时20秒一次
        interval = 20;
        lastTimeStamp = block.timestamp;
    }

    function checkUpkeep(bytes calldata sth) external view returns(bool, bytes memory) {
        bool ok1 = (block.timestamp - lastTimeStamp) > interval;
        bool ok2 = _tokenBank.balances(watchAddr) >= 500; // 大于100就触发
        bytes memory withdrawAmountBytes = abi.encode(_tokenBank.balances(watchAddr) / 2); 
        return (ok1 && ok2, withdrawAmountBytes);
    }

    function performUpkeep(bytes calldata _withdrawAmountBytes) external {
        if ((block.timestamp - lastTimeStamp) > interval && _tokenBank.balances(watchAddr) >= 500) {
            uint withdrawAmount = abi.decode(_withdrawAmountBytes, (uint256));
            _tokenBank.excuateWithdraw(watchAddr, withdrawAmount);
            widrawTimes += 1;

            // chainlink
            lastTimeStamp = block.timestamp;
        }
    }  

}
```

