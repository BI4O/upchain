// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/NFTmarket.sol";

contract NFTMarketDeployScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // 你可以自定义 salt
        bytes32 salt = keccak256(abi.encodePacked("theGraph"));

        // 用 CREATE2 部署 NFT
        NFT nft = new NFT{salt: salt}();
        // 用 CREATE2 部署 ERC20token
        ERC20token token = new ERC20token{salt: salt}();
        // 用 CREATE2 部署 NFTMarket
        NFTMarket market = new NFTMarket{salt: salt}(address(token), address(nft));

        console2.log("NFT deployed at:", address(nft));
        console2.log("ERC20token deployed at:", address(token));
        console2.log("NFTMarket deployed at:", address(market));
        vm.stopBroadcast();
    }
}