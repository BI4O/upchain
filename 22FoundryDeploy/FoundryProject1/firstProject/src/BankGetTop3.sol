// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Bank {
    address public owner;
    address[] public donors;
    mapping(address => uint) public addr2money;
    address[3] public top3donors; // 记录top3捐赠者
    
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
        // 第一次捐款才会进名单，后续再捐不会进名单
        if(addr2money[msg.sender] == 0){
            donors.push(msg.sender);
        }
        // 捐款余额叠加
        addr2money[msg.sender] += msg.value;
        // 检查msg.sender的总捐款是否冲上top3，有的话就更新top3地址
        _updateTop3Donors(msg.sender);
    }
    
    // 2. Bank可以查现在共有多少捐款
    function bankBalance() public view returns (uint) {
        return address(this).balance;
    }
    
    // 3. 管理员可以收回Bank里面所有捐款
    event Withdrawed(address, uint);
    function withdraw() public onlyOwner {
        uint balance = address(this).balance;
        emit Withdrawed(msg.sender, balance);
        (bool success,) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    // 4. 算当前捐款前三多的地址
    function getTop3Donors() public view returns (address[3] memory) {
        return top3donors;
    }
    
    // 5. 每次新捐赠都检查
    function _updateTop3Donors(address newDonor) internal {
        // 一、首先检查该地址是否已经在top3中
        for (uint i = 0; i < 3; i++) {
            if (newDonor == top3donors[i]) {
                // 已经在top3中，需要重新排序，并告诉排序器索引i的元素需要挪动
                _sortTop3Donors(i, newDonor);
                return;
            }
        }
        
        // 如果不在top3中，检查是否应该进入top3
        // 如果有空位(地址为0)或捐款额超过了现有top3中的任何一个
        if (top3donors[0] == address(0) ||
            top3donors[1] == address(0) ||
            top3donors[2] == address(0) ||
            addr2money[newDonor] > addr2money[top3donors[0]] ||
            addr2money[newDonor] > addr2money[top3donors[1]] ||
            addr2money[newDonor] > addr2money[top3donors[2]]) {
            
            // 找到一个位置放入新捐赠者
            if (top3donors[2] == address(0) || addr2money[newDonor] > addr2money[top3donors[2]]) {
                top3donors[2] = newDonor;
            }
            
            // 排序top3，并告诉排序器索引2的元素需要浮动
            _sortTop3Donors(2, newDonor);
        }
    }
    
    // 帮助函数：对top3捐赠者按捐款金额排序
    function _sortTop3Donors(uint i, address newDonor) internal {
        // 本来就最大，加了金额一定还是最大，不用浮动
        if (i == 0) {
            return;
        // 第二名要浮动，仅仅当超过当前第一名才要动
        } else if (i == 1 && addr2money[newDonor] > addr2money[top3donors[0]]) {
            top3donors[1] = top3donors[0];
            top3donors[0] = newDonor;
        // 第三名要浮动，当超过当前第二名但是小于等于第一名的时候，新地址当第二名
        } else if (i == 2 && addr2money[newDonor] > addr2money[top3donors[1]] && 
                  addr2money[newDonor] <= addr2money[top3donors[0]]) {
            top3donors[2] = top3donors[1];
            top3donors[1] = newDonor;
        // 第三名要浮动，当超过当前第一名时候，变成第一名，原第二名退第三，原第一退第二，新地址当第一
        } else if (i == 2 && addr2money[newDonor] > addr2money[top3donors[0]]) {
            top3donors[2] = top3donors[1];
            top3donors[1] = top3donors[0];
            top3donors[0] = newDonor;
        }
    }
}