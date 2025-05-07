// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract A {
	uint public count = 0;
	function add() public virtual {
		count += 1;
	}
}

// 接口定义
interface IA {
	function count() external returns(uint);
	function add() external;
}

// 抽象函数
abstract contract absA{ // 抽象合约
  uint public count = 0;
  function add() public {
      count += 1;
  }
  // 抽象合约意思就是说，你必须实现所有的virtual
  function showBalance() public virtual returns(uint);
  function addMore() public virtual;
}


// 一、继承接口的话，要把状态变量等的都实现，因为接口里面没有
contract AAI is IA {
    uint public count = 5; // 没有写这句编译器会报错
    function add() public override {
        count += 5;
    }
}

// 二、继承合约的话，可以直接用父合约的状态函数
contract AA is A {
	function add() public override {
        super.add();
		count += 2;
	}
}

// 三、继承抽象合约，必须实现完所有的virtual
contract AAabsA is absA {
    function showBalance() public view override returns(uint) {
        return count;
    }
    function addMore() public override {
        count += 10;
    }
}