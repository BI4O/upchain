// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {NFTMarket_V2} from "../src/NFTMarket.sol";

interface IProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external;
}

contract UpgradeToV2 is Script {
    function run() external {
        // 1. 获取参数
        address marketProxy = vm.envAddress("MARKET_PROXY");
        // 2. 开始广播
        vm.startBroadcast();

        // 3. 部署V2逻辑合约
        NFTMarket_V2 marketV2Impl = new NFTMarket_V2();
        console2.log("MarketV2 logic deployed at:", address(marketV2Impl));

        // 4. 升级代理合约到V2
        IProxy(marketProxy).upgradeToAndCall(address(marketV2Impl), "");
        console2.log("Market proxy upgraded to V2");

        vm.stopBroadcast();
    }
} 