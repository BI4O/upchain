// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {NFTMarket, NFT, ERC20token} from "../src/NFTMarketBuyWithERC20.sol";

contract MarketDeployScript is Script {
    function run() public {
        // 开始记录将被广播的交易
        vm.startBroadcast();

        // 部署合约
        NFT nft = new NFT();
        ERC20token token = new ERC20token();
        NFTMarket market = new NFTMarket(address(token), address(nft));

        // 输出部署地址
        console.log("NFT Contract Address: ", address(nft));
        console.log("ERC20 Contract Address: ", address(token));
        console.log("Market Contract Address: ", address(market));

        // 结束广播
        vm.stopBroadcast();
    }
} 