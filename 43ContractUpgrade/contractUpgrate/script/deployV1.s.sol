// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MyToken, MyNFT_V1, MyNFT_Proxy} from "../src/NFT.sol";
import {NFTMarket_V1, NFTMarket_Proxy} from "../src/NFTMarket.sol";

contract DeployV1 is Script {
    function run() external {
        // 1. 获取deployer
        address deployer = msg.sender;
        vm.startBroadcast();

        // 2. 部署ERC20
        MyToken token = new MyToken();
        console2.log("ERC20 deployed at:", address(token));

        // 3. 部署NFT逻辑合约
        MyNFT_V1 nftImpl = new MyNFT_V1();
        console2.log("NFT logic deployed at:", address(nftImpl));

        // 4. 部署NFT代理合约（初始化）
        bytes memory nftInit = abi.encodeWithSelector(MyNFT_V1.initialize.selector, "TestNFT", "TNFT");
        MyNFT_Proxy nftProxy = new MyNFT_Proxy(address(nftImpl), nftInit);
        console2.log("NFT proxy deployed at:", address(nftProxy));

        // 5. 部署MarketV1逻辑合约
        NFTMarket_V1 marketV1Impl = new NFTMarket_V1();
        console2.log("MarketV1 logic deployed at:", address(marketV1Impl));

        // 6. 部署Market代理合约（初始化）
        bytes memory marketInit = abi.encodeWithSelector(NFTMarket_V1.initialize.selector, address(token), address(nftProxy));
        NFTMarket_Proxy marketProxy = new NFTMarket_Proxy(address(marketV1Impl), marketInit);
        console2.log("Market proxy deployed at:", address(marketProxy));

        vm.stopBroadcast();
    }
} 