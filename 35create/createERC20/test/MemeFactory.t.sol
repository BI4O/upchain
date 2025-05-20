// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import "../src/MemeFactory.sol";
import "../src/MemeToken.sol";

contract MemeFactoryTest is Test {
    MemeFactory public factory;
    address public owner;
    address public creator;
    address public buyer;
    
    // 添加receive函数使测试合约能接收ETH
    receive() external payable {}
    
    function setUp() public {
        owner = address(this);
        creator = makeAddr("creator");
        buyer = makeAddr("buyer");
        
        // 部署工厂合约
        factory = new MemeFactory();
        
        // 给创建者和买家一些ETH
        vm.deal(creator, 10 ether);
        vm.deal(buyer, 10 ether);
    }
    
    function testDeployInscription() public {
        vm.startPrank(creator);
        
        string memory symbol = "MEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 100 * 10**18;
        uint256 price = 10**16; // 每个代币0.01 ETH (10^16 wei)
        
        address tokenAddress = factory.deployInscription(symbol, totalSupply, perMint, price);
        
        // 验证代币部署是否成功
        MemeToken token = MemeToken(tokenAddress);
        assertEq(token.symbol(), symbol);
        
        // 验证工厂记录的信息
        (
            string memory storedSymbol,
            uint256 storedTotalSupply,
            uint256 storedPerMint,
            uint256 storedPrice,
            uint256 storedMintedAmount,
            address storedCreator
        ) = getTokenInfo(tokenAddress);
        
        assertEq(storedSymbol, symbol);
        assertEq(storedTotalSupply, totalSupply);
        assertEq(storedPerMint, perMint);
        assertEq(storedPrice, price);
        assertEq(storedMintedAmount, 0);
        assertEq(storedCreator, creator);
        
        vm.stopPrank();
    }
    
    function testMintInscription() public {
        // 先部署一个代币
        vm.startPrank(creator);
        string memory symbol = "MEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 100 * 10**18;
        uint256 price = 10**16; // 每个代币0.01 ETH (10^16 wei)
        address tokenAddress = factory.deployInscription(symbol, totalSupply, perMint, price);
        vm.stopPrank();
        
        // 记录买家、创建者和平台方的初始余额
        uint256 initialBuyerBalance = buyer.balance;
        uint256 initialCreatorBalance = creator.balance;
        uint256 initialOwnerBalance = owner.balance;
        
        // 买家购买代币
        vm.startPrank(buyer);
        uint256 paymentAmount = perMint * price / 10**18; // 调整计算方式，除以10^18将代币数量转为个数
        factory.mintInscription{value: paymentAmount}(tokenAddress);
        vm.stopPrank();
        
        // 验证代币余额
        MemeToken token = MemeToken(tokenAddress);
        assertEq(token.balanceOf(buyer), perMint);
        
        // 验证已铸造数量增加
        (, , , , uint256 mintedAmount, ) = getTokenInfo(tokenAddress);
        assertEq(mintedAmount, perMint);
        
        // 验证费用分配
        uint256 platformFee = (paymentAmount * 1) / 100; // 1% 平台费用
        uint256 creatorFee = paymentAmount - platformFee; // 99% 给创建者
        
        assertEq(buyer.balance, initialBuyerBalance - paymentAmount);
        assertEq(creator.balance, initialCreatorBalance + creatorFee);
        assertEq(owner.balance, initialOwnerBalance + platformFee);
    }
    
    function testMintAll() public {
        // 部署代币，设置只有10次铸造机会
        vm.startPrank(creator);
        string memory symbol = "MEME";
        uint256 perMint = 100 * 10**18;
        uint256 totalSupply = perMint * 10; // 总共可以铸造10次
        uint256 price = 10**16; // 每个代币0.01 ETH (10^16 wei)
        address tokenAddress = factory.deployInscription(symbol, totalSupply, perMint, price);
        vm.stopPrank();
        
        // 铸造10次，应该全部成功
        vm.startPrank(buyer);
        uint256 paymentAmount = perMint * price / 10**18;
        for (uint i = 0; i < 10; i++) {
            factory.mintInscription{value: paymentAmount}(tokenAddress);
        }
        
        // 再次给买家一些ETH，确保资金充足
        vm.deal(buyer, 10 ether);
        
        // 第11次铸造应该失败，因为已经全部铸造完毕
        vm.expectRevert("All tokens minted");
        factory.mintInscription{value: paymentAmount}(tokenAddress);
        vm.stopPrank();
        
        // 验证所有代币都已铸造
        MemeToken token = MemeToken(tokenAddress);
        assertEq(token.balanceOf(buyer), totalSupply);
    }
    
    function testTokenTransfer() public {
        // 部署代币
        vm.startPrank(creator);
        string memory symbol = "MEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 100 * 10**18;
        uint256 price = 10**16; // 每个代币0.01 ETH (10^16 wei)
        address tokenAddress = factory.deployInscription(symbol, totalSupply, perMint, price);
        vm.stopPrank();
        
        // 买家买入代币
        vm.startPrank(buyer);
        factory.mintInscription{value: perMint * price / 10**18}(tokenAddress);
        
        // 测试代币转账
        address receiver = makeAddr("receiver");
        uint256 transferAmount = 50 * 10**18;
        
        MemeToken token = MemeToken(tokenAddress);
        token.transfer(receiver, transferAmount);
        vm.stopPrank();
        
        // 验证余额变化
        assertEq(token.balanceOf(buyer), perMint - transferAmount);
        assertEq(token.balanceOf(receiver), transferAmount);
    }
    
    function testIncorrectPayment() public {
        // 部署代币
        vm.startPrank(creator);
        string memory symbol = "MEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 100 * 10**18;
        uint256 price = 10**16; // 每个代币0.01 ETH (10^16 wei)
        address tokenAddress = factory.deployInscription(symbol, totalSupply, perMint, price);
        vm.stopPrank();
        
        // 买家支付错误金额
        vm.startPrank(buyer);
        uint256 incorrectAmount = 0.5 ether; // 不等于 perMint * price / 10**18 = 1 ether
        
        vm.expectRevert("Incorrect payment amount");
        factory.mintInscription{value: incorrectAmount}(tokenAddress);
        vm.stopPrank();
    }
    
    // 辅助函数：获取代币信息
    function getTokenInfo(address tokenAddress) internal view returns (
        string memory symbol,
        uint256 totalSupply,
        uint256 perMint,
        uint256 price,
        uint256 mintedAmount,
        address creator
    ) {
        (symbol, totalSupply, perMint, price, mintedAmount, creator) = factory.memeTokens(tokenAddress);
    }
} 