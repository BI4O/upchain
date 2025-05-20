// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Bank {
    address public owner;
    address[] public donors;
    mapping(address => uint) public addr2money;

    // 记录管理员
    constructor() {
        owner = msg.sender;
    }

    // 限制管理员才能执行
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // 1. Bank接受外部eoa的转账作捐款
    event Received(address, uint);
    receive() external payable { 
        emit Received(msg.sender, msg.value);       

        // 第一次捐款才会名单，后续再捐不会进名单
        if(addr2money[msg.sender] == 0){
            donors.push(msg.sender);
        }

        addr2money[msg.sender] += msg.value;
    }

    // 2. Bank可以查现在共有多少捐款
    function bankBalance() public view returns (uint) {
        return address(this).balance;
    }

    // 3. 管理员可以收回Bank里面所有捐款
    event Withdrawed(address, uint);
    function withdraw()public onlyOwner{
        emit Withdrawed(msg.sender, address(this).balance);
        payable(owner).transfer(address(this).balance);
    }

    // 4. 算当前捐款前三多的地址
    function getTop3Donors() public view returns (address[3] memory) {
        address[] memory temp = donors; // 拷贝 donors 到 memory 中排序，不影响原始数组
        uint n = temp.length;

        // 简单冒泡排序，按金额从大到小
        for (uint i = 0; i < n; i++) {
            for (uint j = 0; j < n - 1 - i; j++) {
                if (addr2money[temp[j]] < addr2money[temp[j + 1]]) {
                    (temp[j], temp[j + 1]) = (temp[j + 1], temp[j]);
                }
            }
        }

        // 返回前3名（不足3个就补零地址）
        address[3] memory top;
        for (uint i = 0; i < 3 && i < temp.length; i++) {
            top[i] = temp[i];
        }
        return top;
    }

}