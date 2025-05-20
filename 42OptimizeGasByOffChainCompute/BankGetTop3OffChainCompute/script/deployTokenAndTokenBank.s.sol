// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MyToken} from "../src/token.sol";
import {TokenBank} from "../src/tokenBank.sol";

contract DeployTokenAndTokenBank is Script {
    function run() external {
        
        // 开始使用私钥签名交易
        vm.startBroadcast();

        // 部署MyToken合约
        MyToken token = new MyToken();
        
        // 部署TokenBank合约，并将token地址传给它
        TokenBank bank = new TokenBank(address(token));
        
        // 停止广播
        vm.stopBroadcast();

        // 输出部署信息
        console.log("MyToken deployed at:", address(token));
        console.log("TokenBank deployed at:", address(bank));
    }
} 