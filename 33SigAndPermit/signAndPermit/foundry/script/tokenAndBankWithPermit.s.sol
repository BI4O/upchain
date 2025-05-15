// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tokenAndBankWithPermit.sol";

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

        // 1. Deploy token contract
        MyToken token = new MyToken();
        console.log("MyToken deployed to: ", address(token));
        console.log("Token name: ", token.name());
        console.log("Token symbol: ", token.symbol());
        console.log("Initial supply: ", token.totalSupply());
        
        // 2. Deploy bank contract
        tokenBank bank = new tokenBank(address(token));
        console.log("tokenBank deployed to: ", address(bank));
        console.log("Bank token address: ", address(bank.token()));
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Output deployment summary
        console.log("\n----- Deployment Summary -----");
        console.log("MyToken: ", address(token));
        console.log("tokenBank: ", address(bank));
        console.log("---------------------");
    }
}

/**
 * @title TokenAndBankInteractScript
 * @notice Interaction example script to show how to interact with deployed contracts
 * @dev Use this script after deployment to interact with contracts
 * 
 * Example usage:
 * $ forge script script/tokenAndBankWithPermit.s.sol:TokenAndBankInteractScript --rpc-url <RPC> --broadcast --account <ACCOUNT_NAME>
 */
contract TokenAndBankInteractScript is Script {
    // Deployed contract addresses (these are the actual addresses from the deployment)
    address constant TOKEN_ADDRESS = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address constant BANK_ADDRESS = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    
    // Contract instances
    MyToken token;
    tokenBank bank;
    
    // User info
    address userAddress;
    
    function run() public {
        // Get user address from account
        userAddress = msg.sender;
        
        // Initialize contract interfaces
        token = MyToken(TOKEN_ADDRESS);
        bank = tokenBank(BANK_ADDRESS);
        
        // Display initial state
        displayBalances("Initial");
        
        // Start broadcasting
        vm.startBroadcast();
        
        // Run different interaction examples
        traditionalDeposit(100);
        permitDeposit(200);
        withdrawFromBank();
        
        // Stop broadcasting
        vm.stopBroadcast();
    }
    
    /**
     * @notice Display token and bank balances
     */
    function displayBalances(string memory label) internal view {
        console.log(string.concat(label, " token balance: "), token.balanceOf(userAddress));
        console.log(string.concat(label, " bank deposit: "), bank.balanceOf(userAddress));
    }
    
    /**
     * @notice Perform a traditional deposit (approve + deposit)
     */
    function traditionalDeposit(uint256 amount) internal {
        // Traditional approve and deposit
        token.approve(BANK_ADDRESS, amount);
        bank.deposit(amount);
        displayBalances("After traditional deposit");
    }
    
    /**
     * @notice Perform a deposit using EIP-2612 Permit
     */
    function permitDeposit(uint256 amount) internal {
        // 注意：在实际部署中，Permit签名通常在前端完成
        // 对于这个示例，我们必须跳过Permit签名部分，因为我们无法在脚本中访问账户的私钥

        // 相反，我们将使用传统方式来演示流程
        console.log("Note: Permit signing skipped in script. Using traditional method instead.");
        console.log("In a real dApp, signing would happen in the frontend.");
        
        // 使用传统授权方式
        token.approve(BANK_ADDRESS, amount);
        bank.deposit(amount);
        displayBalances("After deposit (permit skipped)");
    }
    
    /**
     * @notice Generate the EIP-2612 permit digest
     */
    function getPermitDigest(
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline));
        
        bytes32 DOMAIN_SEPARATOR = token.DOMAIN_SEPARATOR();
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
    
    /**
     * @notice Withdraw funds from the bank
     */
    function withdrawFromBank() internal {
        bank.withdraw();
        displayBalances("After withdrawal");
    }
}
