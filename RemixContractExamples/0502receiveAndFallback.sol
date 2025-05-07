// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReceiveAndFallBack {
    // 假设这是一个钱包，你忘这里存一些钱
    // 1. 如果没有reveive，会调用fallback，如果fallback有payable也可以收款
    // 2. 如果有receive，优先调用receive来接收函数
    uint public fbCall = 0;
    uint public rcCall = 0;

    event ReceiveCall(address);
    receive() external payable { 
        emit ReceiveCall(msg.sender);
        rcCall += 1;
    }

    event FallbackCall(address);
    fallback() external payable { 
        emit FallbackCall(msg.sender);
        fbCall += 1;
    }

    function withdraw() public {
        payable(msg.sender).transfer(address(this).balance);
    }

    function showBalance() public view returns(uint) {
        return address(this).balance;
    }
}