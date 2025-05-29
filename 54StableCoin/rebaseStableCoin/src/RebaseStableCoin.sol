// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 根据rebase原理，写的stableCoin
/*
 y = (1/k) * x
 y是大家用balanceOf看到的虚假的余额amount
 x才是记账中真实不变的余额share
 但是大家转账的时候输入的却是y这个虚假的余额，我们要帮他转换成x这个固定的余额

 一开始大家都可以用eth来mint出所谓的y的余额
*/
contract StableCoin is ERC20 {

    uint public initSupply;
    uint public currSupply;
    uint public k;
    uint public mintedX;
    mapping(address => uint) public XbalanceOf;

    // 通缩
    uint public lastTimeRebase;
    uint public interval = 365 days;
    uint public rebaseTimes = 0;

    constructor() ERC20("StableCoin","SC") {
        initSupply = 1e8 ether;
        currSupply = 1e8 ether;
        k = (1e23 * currSupply)/initSupply; // 随着currSupply变小，k会变大
        lastTimeRebase = block.timestamp; // 创建开始计时
    }

    // 大家用真金白银的eth来买虚高的y，实际上我们给他记账x
    function mint() public payable {
        uint createX = yTox(msg.value);
        mintedX += createX;
        require(mintedX <= currSupply, "Supply exeed!"); // 超过发行量，有钱也买不了
        XbalanceOf[msg.sender] += createX;
    }

    // 看余额，是虚假的余额Y，看起来偏大的快乐表
    function balanceOf(address account) public view override returns(uint){
        return xToy(XbalanceOf[account]);
    }

    // 依然是快乐表Y的值
    function totalSupply() public view override returns (uint256) {
        return xToy(currSupply);
    }

    function yTox(uint amountY) internal view returns(uint){
        // x = k * y
        return k * amountY / 1e23;
    }

    function xToy(uint amountX) internal view returns(uint){
        // y = x / k
        return amountX * 1e23 / k;
    }

    function rebase() public {
        uint passTime = block.timestamp - lastTimeRebase;
        uint shouldRebaseTimes = (passTime / interval) - rebaseTimes;
        require(shouldRebaseTimes > 0, "not yet!");
        for (uint256 i = 0; i < shouldRebaseTimes; i++) {
            currSupply = currSupply * 99 / 100;  // 发行量变少
            k = (1e23 * currSupply)/initSupply; // k变小，x不变的情况下y会变大
        }
        rebaseTimes += shouldRebaseTimes;
        lastTimeRebase = block.timestamp;
    }

}