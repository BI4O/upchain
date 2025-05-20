// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {NFTMarket, NFT, ERC20token} from "../src/NFTMarketBuyWithERC20.sol";

contract MarketDeployScript is Script {
    function run() public {
        // 开始记录将被广播的交易
        vm.startBroadcast();
        
        // 用一个项目方的独立账号，anvil第三位
        // 私钥：0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
        address signer = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

        // 部署合约
        NFT nft = new NFT();
        ERC20token token = new ERC20token();
        NFTMarket market = new NFTMarket(address(token), address(nft), signer);

        // 输出部署地址
        console.log("NFT Contract Address: ", address(nft));
        console.log("ERC20 Contract Address: ", address(token));
        console.log("Market Contract Address: ", address(market));
        console.log("Signer Address: ", signer);

        // 结束广播
        vm.stopBroadcast();
    }
} 