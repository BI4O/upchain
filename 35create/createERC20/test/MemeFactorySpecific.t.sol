// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import "../src/MemeFactory.sol";
import "../src/MemeToken.sol";

contract MemeFactorySpecificTest is Test {
    MemeFactory public factory;
    address public owner;
    address public creator;
    address public buyer1;
    address public buyer2;
    
    // 添加receive函数使测试合约能接收ETH
    receive() external payable {}
    
    function setUp() public {
        owner = address(this);
        creator = makeAddr("creator");
        buyer1 = makeAddr("buyer1");
        buyer2 = makeAddr("buyer2");
        
        // 部署工厂合约
        factory = new MemeFactory();
        
        // 给各账户一些ETH
        vm.deal(creator, 10 ether);
        vm.deal(buyer1, 10 ether);
        vm.deal(buyer2, 10 ether);
    }
    
    // 测试1：费用按比例正确分配到 Meme 发行者账号及项目方账号
    function testFeeDistribution() public {
        // 部署代币
        vm.startPrank(creator);
        string memory symbol = "MEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 100 * 10**18;
        uint256 price = 10**16; // 每个代币0.01 ETH (10^16 wei)
        address tokenAddress = factory.deployInscription(symbol, totalSupply, perMint, price);
        vm.stopPrank();
        
        // 记录初始余额
        uint256 initialCreatorBalance = creator.balance;
        uint256 initialOwnerBalance = owner.balance;
        uint256 initialBuyer1Balance = buyer1.balance;
        
        // 计算预期的支付金额和分配
        uint256 paymentAmount = perMint * price / 10**18; // 支付总额
        uint256 expectedPlatformFee = (paymentAmount * 1) / 100; // 1%给平台方
        uint256 expectedCreatorFee = paymentAmount - expectedPlatformFee; // 99%给创建者
        
        // 买家购买代币
        vm.startPrank(buyer1);
        factory.mintInscription{value: paymentAmount}(tokenAddress);
        vm.stopPrank();
        
        // 验证各方余额变化
        assertEq(buyer1.balance, initialBuyer1Balance - paymentAmount, "Buyer1 balance incorrect");
        assertEq(creator.balance, initialCreatorBalance + expectedCreatorFee, "Creator balance incorrect");
        assertEq(owner.balance, initialOwnerBalance + expectedPlatformFee, "Owner balance incorrect");
        
        // 进行多次购买测试，确保累计金额正确
        initialCreatorBalance = creator.balance;
        initialOwnerBalance = owner.balance;
        uint256 initialBuyer2Balance = buyer2.balance;
        
        // 买家2购买3次
        vm.startPrank(buyer2);
        for (uint i = 0; i < 3; i++) {
            factory.mintInscription{value: paymentAmount}(tokenAddress);
        }
        vm.stopPrank();
        
        // 验证多次购买后的余额
        assertEq(buyer2.balance, initialBuyer2Balance - (paymentAmount * 3), "Buyer2 balance incorrect");
        assertEq(creator.balance, initialCreatorBalance + (expectedCreatorFee * 3), "Creator accumulated balance incorrect");
        assertEq(owner.balance, initialOwnerBalance + (expectedPlatformFee * 3), "Owner accumulated balance incorrect");
    }
    
    // 测试2：每次发行的数量正确，且不会超过 totalSupply
    function testMintingLimits() public {
        // 部署代币，设置特定的铸造次数
        vm.startPrank(creator);
        string memory symbol = "MEME";
        uint256 perMint = 100 * 10**18; // 每次铸造100个代币
        uint256 totalSupply = perMint * 5; // 总共可铸造5次
        uint256 price = 10**16; // 每个代币0.01 ETH
        address tokenAddress = factory.deployInscription(symbol, totalSupply, perMint, price);
        vm.stopPrank();
        
        uint256 paymentAmount = perMint * price / 10**18;
        
        // 每次铸造后检查已铸造数量和剩余可铸造数量
        for (uint i = 1; i <= 5; i++) {
            vm.startPrank(buyer1);
            factory.mintInscription{value: paymentAmount}(tokenAddress);
            vm.stopPrank();
            
            // 获取代币信息
            (, , , , uint256 currentMintedAmount, ) = factory.memeTokens(tokenAddress);
            
            // 验证已铸造数量
            assertEq(currentMintedAmount, perMint * i, "Incorrect minted amount");
            
            // 验证买家余额
            MemeToken tokenInstance = MemeToken(tokenAddress);
            assertEq(tokenInstance.balanceOf(buyer1), perMint * i, "Buyer token balance incorrect");
        }
        
        // 尝试第6次铸造，应该失败
        vm.startPrank(buyer1);
        vm.expectRevert("All tokens minted");
        factory.mintInscription{value: paymentAmount}(tokenAddress);
        vm.stopPrank();
        
        // 验证总铸造量不超过totalSupply
        (, uint256 storedTotalSupply, , , uint256 finalMintedAmount, ) = factory.memeTokens(tokenAddress);
        assertEq(finalMintedAmount, storedTotalSupply, "Minted amount exceeded total supply");
        
        // 验证买家代币总额等于totalSupply
        MemeToken finalToken = MemeToken(tokenAddress);
        assertEq(finalToken.balanceOf(buyer1), totalSupply, "Buyer final token balance incorrect");
    }
    
    // 测试3：验证perMint参数是否正确控制每次铸造的数量
    function testPerMintParameter() public {
        // 部署两个不同perMint的代币
        vm.startPrank(creator);
        
        // 代币1: 每次铸造50代币
        string memory symbol1 = "MEM1";
        uint256 perMint1 = 50 * 10**18;
        uint256 totalSupply1 = 1000 * 10**18;
        uint256 price1 = 10**16;
        address token1Address = factory.deployInscription(symbol1, totalSupply1, perMint1, price1);
        
        // 代币2: 每次铸造200代币
        string memory symbol2 = "MEM2";
        uint256 perMint2 = 200 * 10**18;
        uint256 totalSupply2 = 1000 * 10**18;
        uint256 price2 = 10**16;
        address token2Address = factory.deployInscription(symbol2, totalSupply2, perMint2, price2);
        
        vm.stopPrank();
        
        // 每个代币铸造一次
        vm.startPrank(buyer1);
        factory.mintInscription{value: perMint1 * price1 / 10**18}(token1Address);
        factory.mintInscription{value: perMint2 * price2 / 10**18}(token2Address);
        vm.stopPrank();
        
        // 验证铸造数量与perMint相符
        MemeToken token1 = MemeToken(token1Address);
        MemeToken token2 = MemeToken(token2Address);
        
        assertEq(token1.balanceOf(buyer1), perMint1, "Token1: incorrect minted amount");
        assertEq(token2.balanceOf(buyer1), perMint2, "Token2: incorrect minted amount");
        
        // 验证记录的已铸造数量
        (, , uint256 storedPerMint1, , uint256 mintedAmount1, ) = factory.memeTokens(token1Address);
        (, , uint256 storedPerMint2, , uint256 mintedAmount2, ) = factory.memeTokens(token2Address);
        
        assertEq(mintedAmount1, storedPerMint1, "Token1: mintedAmount should equal perMint");
        assertEq(mintedAmount2, storedPerMint2, "Token2: mintedAmount should equal perMint");
    }
} 