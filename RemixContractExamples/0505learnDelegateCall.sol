// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract B {
    uint public count = 0;
    
    constructor() payable {}

    function showBalance() public view returns(uint){
        return address(this).balance;
    }

    function withdraw(uint amount) public {
        count ++;
        payable(msg.sender).transfer(amount);
    }
}

contract A {
    uint public count = 0;

    receive() external payable { }

    function call(address Baddr, uint amount) public returns(bool){
        // 此时msg.sender = A合约地址
        bytes memory playload = abi.encodeWithSignature("withdraw(uint256)",amount);
        (bool success,) = Baddr.call(playload);
        return success;
    }

    function delegatecall(address Baddr, uint amount) public returns(bool){
        // 此时相当于msg.sender = 我
        bytes memory playload = abi.encodeWithSignature("withdraw(uint256)",amount);
        (bool success,) = Baddr.delegatecall(playload);
        return success;
    }

    function showBalance() public view returns(uint) {
        return address(this).balance;
    }

    function showBalanceUseStaticcall(address Baddr) public view returns(uint){
        bytes memory playload = abi.encodeWithSignature("showBalance()");
        (bool success, bytes memory rawData) = Baddr.staticcall(playload);
        require(success);
        return abi.decode(rawData, (uint));
    }
}