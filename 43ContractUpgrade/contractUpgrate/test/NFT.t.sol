// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NFT.sol";

contract NFTTest is Test {
    // Contract instances
    MyNFT_V1 implementation;
    MyNFT_Proxy proxy;
    MyNFT_V1 nft;
    
    // Test addresses
    address deployer = address(1);
    address user = address(2);
    
    // Test parameters
    string constant NFT_NAME = "TestNFT";
    string constant NFT_SYMBOL = "TNFT";
    
    function setUp() public {
        // Deploy contracts with specific address
        vm.startPrank(deployer);
        
        // Deploy V1 implementation
        implementation = new MyNFT_V1();
        
        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            MyNFT_V1.initialize.selector,
            NFT_NAME,
            NFT_SYMBOL
        );
        
        // Deploy proxy contract
        proxy = new MyNFT_Proxy(address(implementation), initData);
        
        // Access NFT through proxy
        nft = MyNFT_V1(address(proxy));
        
        vm.stopPrank();
    }
    
    // Test initialization state
    function testInitialization() public {
        assertEq(nft.name(), NFT_NAME, "NFT name should match initialization");
        assertEq(nft.symbol(), NFT_SYMBOL, "NFT symbol should match initialization");
        assertEq(nft.owner(), deployer, "Deployer should be the NFT owner");
    }
    
    // Test minting functionality
    function testMint() public {
        // Only owner can mint
        vm.startPrank(deployer);
        
        uint256 tokenId = 1;
        nft.mint(user, tokenId);
        
        vm.stopPrank();
        
        // Verify minting result
        assertEq(nft.ownerOf(tokenId), user, "User should be the token owner");
        assertEq(nft.balanceOf(user), 1, "User should have 1 token");
    }
    
    // Test minting fails for non-owner
    function testMintFailsForNonOwner() public {
        vm.startPrank(user);
        
        uint256 tokenId = 1;
        vm.expectRevert(); // Expect failure
        nft.mint(user, tokenId);
        
        vm.stopPrank();
    }
    
    // Test multiple minting operations through proxy
    function testMultipleMints() public {
        vm.startPrank(deployer);
        
        // Mint several tokens to different users
        nft.mint(user, 1);
        nft.mint(address(3), 2);
        nft.mint(address(4), 3);
        
        vm.stopPrank();
        
        // Verify ownership
        assertEq(nft.ownerOf(1), user, "User should own token 1");
        assertEq(nft.ownerOf(2), address(3), "Address 3 should own token 2");
        assertEq(nft.ownerOf(3), address(4), "Address 4 should own token 3");
        
        // Verify balances
        assertEq(nft.balanceOf(user), 1, "User should have 1 token");
        assertEq(nft.balanceOf(address(3)), 1, "Address 3 should have 1 token");
        assertEq(nft.balanceOf(address(4)), 1, "Address 4 should have 1 token");
    }
} 