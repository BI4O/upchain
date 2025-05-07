// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract A {
	uint public count = 0;
	function add() public {
		count += 1;
	}
}

// 接口定义
interface IA {
	function count() external returns(uint);
	function add() external;
}

// A合约部署后，就可以拿合约地址给IA来得到对象，然后远程调用
contract B {
	function remoteCallAdd(address remoteAddr) public {
		// 把IA想象成一个合约类型，然后给地址来初始化
		IA remoteContract = IA(remoteAddr);
		remoteContract.add();
	}
}
