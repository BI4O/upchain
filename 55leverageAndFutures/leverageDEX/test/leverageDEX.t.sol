// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "src/leverageDEX.sol";

contract SimpleLeverageDEXTest is Test {
    USDCBase usdc;
    SimpleLeverageDEX dex;
    address user;
    address liquidator;

    function setUp() public {
        // 100 ETH，每枚3000U，USDC池30万
        uint vETH = 100_000 ether;
        uint vUSDC = 300_000_000 ether;
        dex = new SimpleLeverageDEX(vETH, vUSDC);
        // 设置USDC合约地址
        usdc = dex.USDC(); 
        user = vm.addr(1);
        liquidator = vm.addr(2);
        // 给user和liquidator铸造USDC
        usdc.mint(user, 10_000 ether);
        usdc.mint(liquidator, 10_000 ether);
        // 给DEX合约铸造池子USDC，解决InsufficientBalance
        usdc.mint(address(dex), 300_000 ether);
        // 给user授权
        vm.prank(user);
        usdc.approve(address(dex), type(uint256).max);
        vm.prank(liquidator);
        usdc.approve(address(dex), type(uint256).max);
    }

    function testOpenLongAndClose() public {
        vm.startPrank(user);
        // 用户用1000U，3倍杠杆做多
        dex.openPosition(1000 ether, 3, true);
        // 检查持仓
        (uint256 margin, uint256 borrowed, int256 position) = dex.positions(user);
        assertEq(margin, 1000 ether);
        assertEq(borrowed, 2000 ether);
        assertGt(position, 0);
        // 平仓
        dex.closePosition();
        // 持仓应被清空
        (margin, borrowed, position) = dex.positions(user);
        assertEq(margin, 0);
        assertEq(borrowed, 0);
        assertEq(position, 0);
        vm.stopPrank();
    }

    function testOpenShortAndClose() public {
        vm.startPrank(user);
        // 用户用1000U，3倍杠杆做空
        dex.openPosition(1000 ether, 3, false);
        (uint256 margin, uint256 borrowed, int256 position) = dex.positions(user);
        assertEq(margin, 1000 ether);
        assertEq(borrowed, 2000 ether);
        assertLt(position, 0);
        // 平仓
        dex.closePosition();
        (margin, borrowed, position) = dex.positions(user);
        assertEq(margin, 0);
        assertEq(borrowed, 0);
        assertEq(position, 0);
        vm.stopPrank();
    }

    function testLiquidationSuccess() public {
        vm.startPrank(user);
        dex.openPosition(1000 ether, 10, true);
        vm.stopPrank();
        // 模拟ETH价格暴跌到极低，确保能清算
        simulateSwapTilETHPriceLowerThan(2700); // 目标价低于开仓价
        int256 pnl = dex.calculatePnL(user);
        uint256 payout = pnl > 0 ? uint256(pnl) : 0;
        console.log("payout:");
        console.logUint(payout);
        console.log("liquidation line:");
        console.logUint(1000 ether * 2 / 10);
        vm.startPrank(liquidator);
        dex.liquidatePosition(user);
        (uint256 margin, uint256 borrowed, int256 position) = dex.positions(user);
        assertEq(margin, 0);
        assertEq(borrowed, 0);
        assertEq(position, 0);
        vm.stopPrank();
    }

    function testLiquidationFail() public {
        vm.startPrank(user);
        dex.openPosition(1000 ether, 10, true);
        vm.stopPrank();
        // 模拟ETH价格只跌到略高于清算线
        simulateSwapTilETHPriceLowerThan(2900); // 目标价略低于开仓价，但远高于极端清算
        int256 pnl = dex.calculatePnL(user);
        uint256 payout = pnl > 0 ? uint256(pnl) : 0;
        console.log("payout:");
        console.logUint(payout);
        console.log("liquidation line:");
        console.logUint(1000 ether * 2 / 10);
        vm.startPrank(liquidator);
        vm.expectRevert(bytes("Not lower than 20% margin!"));
        dex.liquidatePosition(user);
        vm.stopPrank();
    }

    function testLongTakeProfit() public {
        vm.startPrank(user);
        dex.openPosition(1000 ether, 3, true);
        vm.stopPrank();
        // 模拟有人追多，ETH价格上涨
        int256 pnl0 = dex.calculatePnL(user);
        int256 pnl = pnl0;
        while (pnl < pnl0 * 3 / 2) { // 盈利50%
            dex.testSwapUSDCForETH(1000 ether);
            pnl = dex.calculatePnL(user);
        }
        // 计算实际赚了多少钱
        int256 profit = pnl - pnl0;
        console.log("take profit pnl:");
        console.logInt(pnl);
        console.log("profit(USDC):");
        console.logInt(profit / 1 ether);
        console.log("profit rate(%):");
        console.logInt((profit * 100) / int256(1000 ether));
        vm.startPrank(user);
        dex.closePosition();
        (uint256 margin, uint256 borrowed, int256 position) = dex.positions(user);
        assertEq(margin, 0);
        assertEq(borrowed, 0);
        assertEq(position, 0);
        vm.stopPrank();
    }

    function testLongStopLoss() public {
        vm.startPrank(user);
        dex.openPosition(1000 ether, 3, true);
        vm.stopPrank();
        // 模拟有人追空，ETH价格下跌
        int256 pnl0 = dex.calculatePnL(user);
        int256 pnl = pnl0;
        while (pnl > pnl0 / 2) { // 亏损50%
            dex.testSwapETHForUSDC(100 ether);
            pnl = dex.calculatePnL(user);
        }
        // 计算实际亏了多少钱
        int256 loss = pnl0 - pnl;
        console.log("stop loss pnl:");
        console.logInt(pnl);
        console.log("Loss(USDC):");
        console.logInt(loss / 1 ether);
        console.log("Loss rate(%):");
        console.logInt((loss * 100) / int256(1000 ether));
        vm.startPrank(user);
        dex.closePosition();
        (uint256 margin, uint256 borrowed, int256 position) = dex.positions(user);
        assertEq(margin, 0);
        assertEq(borrowed, 0);
        assertEq(position, 0);
        vm.stopPrank();
    }

    // 辅助函数：模拟swap直到ETH价格低于目标价
    function simulateSwapTilETHPriceLowerThan(uint targetPrice) public returns (uint finalPrice, uint totalEthIn) {
        // 当前价格
        uint price = dex.vUSDCAmount() / dex.vETHAmount();
        totalEthIn = 0;
        // 每次swap 1 ether，直到价格低于目标
        while (price > targetPrice) {
            dex.testSwapETHForUSDC(10 ether);
            totalEthIn += 10 ether;
            price = dex.vUSDCAmount() / dex.vETHAmount();
            // 防止死循环
            if (totalEthIn > 10000 ether) break;
        }
        finalPrice = price;
        console.log("simulateSwapTilETHPriceLowerThan finished, finalPrice:");
        console.logUint(finalPrice);
        console.log("totalEthIn:");
        console.logUint(totalEthIn);
        return (finalPrice, totalEthIn);
    }
} 