// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract Counter {
    uint public counter = 0;

    function get() public view returns(uint){
        return counter;
    }

    function add(uint x) public {
        counter += x;
    }
}

// 部署到sepolia合约地址：0xe3dd8147b8F110237FC6E0aD55985c808facC34C
// 发起add函数调用的tx在浏览器网址：https://sepolia.etherscan.io/tx/0x213c2685faad51a8be33c4a6cd62c7742ebefad5ca771af9b00508b5f3fe6336