// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract learnEvent {
    receive() external payable {}

    event MoneyUp(address indexed sender, uint amount);
    function getMoreMoney() public payable {
        emit MoneyUp(msg.sender, msg.value);
        // payable(address(this)).transfer(msg.value);
    }
}