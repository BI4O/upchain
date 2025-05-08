// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {MyToken} from "../src/erc20token.sol";

contract DeployMyToken is Script {
    function run() external {

        // 1. 开始广播
        vm.startBroadcast();

        // 2. 部署
        MyToken token = new MyToken("MyToken", "MTK");

        // 3. 停止广播
        vm.stopBroadcast(); 

        // 4. 打印成功信息
        console.log("Deployed on chain ID:", block.chainid);
        console.log("Deployed succsee at:", address(token));
    }
}
