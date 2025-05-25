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

- `checkUpKeep()`：其实就是一个trigger，返回一个bool，告诉自动化程序是否自动化执行
- `performKeep()`：这个方法就是当脚本checkupkeep=true的时候，就回触发的函数

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

contract Counter {
		uint public counter;
		uint public immutable interval; // 间隔时间
		uint public lastTimeStamp;
		
		event Perform(uint counter);
		constructor(uint updateInterval) {
				interval = updateInterval; // 确定间隔时间
				lastTimeStamp = block.timestamp; // 开始时间
				counter = 0; // 触发次数
		}
		
		function checkUpkeep(bytes calldata) external view returns(bool) 
				// 现在距离上一次触发间隔，够了最小间隔了没？
				// 够了就返回true
				return (block.timestamp - lastTimeStamp) > interval;
		}
	
		function performUpkeep(bytes calldata) external {
				// 还是建议在再执行一次检查
				require(checkUpkeep);
				lastTimeStamp = block.timestamp;
				counter += 1;
				emit Perform(count);
  	}
  	
```

