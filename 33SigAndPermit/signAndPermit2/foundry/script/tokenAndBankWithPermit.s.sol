// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Script.sol";
import "../src/tokenAndBankWithPermit.sol";
import "permit2/src/Permit2.sol";

/**
 * @title TokenAndBankDeployScript
 * @notice Deploy script for MyToken and tokenBank contracts
 * @dev Use the forge script command to execute this script
 * 
 * Deploy to local network:
 * $ forge script script/tokenAndBankWithPermit.s.sol --rpc-url http://localhost:8545 --broadcast --account <ACCOUNT_NAME>
 * 
 * Deploy to test network:
 * $ forge script script/tokenAndBankWithPermit.s.sol --rpc-url <TEST_RPC> --broadcast --account <ACCOUNT_NAME>
 */
contract TokenAndBankDeployScript is Script {
    function run() public {
        // Start broadcasting with default signer
        // No need to manually get private key when using --account flag
        vm.startBroadcast();

        // 1. 部署 Permit2
        Permit2 permit2 = new Permit2();
        console.log("Permit2 deployed to: ", address(permit2));

        // 2. 部署 token 合约
        MyToken token = new MyToken();
        console.log("MyToken deployed to: ", address(token));
        console.log("Token name: ", token.name());
        console.log("Token symbol: ", token.symbol());
        console.log("Initial supply: ", token.totalSupply());
        
        // 3. 部署 bank 合约，传入token和permit2地址
        tokenBank bank = new tokenBank(address(token), address(permit2));
        console.log("tokenBank deployed to: ", address(bank));
        console.log("Bank token address: ", address(bank.token()));
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Output deployment summary
        console.log("\n----- Deployment Summary -----");
        console.log("Permit2: ", address(permit2));
        console.log("MyToken: ", address(token));
        console.log("tokenBank: ", address(bank));
        console.log("---------------------");
    }
}
