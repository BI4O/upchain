// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/StakingPool.sol";

contract StakingPoolTest is Test {
    StakingPool public pool;
    address userA = vm.addr(1);
    address userB = vm.addr(2);

    function setUp() public {
        pool = new StakingPool();
        vm.deal(userA, 100000 ether);
        vm.deal(userB, 100000 ether);
    }

    function testInit() public {
        assertEq(pool.kkPerBlock(), 10);
        assertEq(pool.lastRewardBlock(), block.number);
        assertEq(pool.acckkPerShare(), 0);
        assertEq(pool.totalStaked(), 0);
    }

    function testSingleStakeAndClaim() public {
        vm.startPrank(userA);
        pool.stake{value: 1 ether}();
        console.log("after stake, pool balance:", address(pool).balance);
        console.log("after stake, totalStaked:", pool.totalStaked());
        console.log("after stake, userA staked:", pool.balanceOf(userA));
        vm.roll(block.number + 10); // 跳过10个区块
        pool.updatePool(); // 触发奖励结算
        pool.claim();
        console.log("after claim, userA KK:", pool.kk().balanceOf(userA));
        console.log("after claim, acckkPerShare:", pool.acckkPerShare());
        vm.stopPrank();
    }

    function testMultiUserStakeAndReward() public {
        // A先质押
        vm.startPrank(userA);
        pool.stake{value: 1 ether}();
        console.log("A stake, pool balance:", address(pool).balance);
        console.log("A stake, totalStaked:", pool.totalStaked());
        vm.stopPrank();
        vm.roll(block.number + 5);
        pool.updatePool(); // 触发奖励结算
        // B后质押
        vm.startPrank(userB);
        pool.stake{value: 1 ether}();
        console.log("B stake, pool balance:", address(pool).balance);
        console.log("B stake, totalStaked:", pool.totalStaked());
        vm.stopPrank();
        vm.roll(block.number + 5);
        pool.updatePool(); // 触发奖励结算
        // A领取
        vm.startPrank(userA);
        pool.claim();
        console.log("A claim, userA KK:", pool.kk().balanceOf(userA));
        vm.stopPrank();
        // B领取
        vm.startPrank(userB);
        pool.claim();
        console.log("B claim, userB KK:", pool.kk().balanceOf(userB));
        vm.stopPrank();
    }

    function testMultipleStakeClaim() public {
        vm.startPrank(userA);
        pool.stake{value: 1 ether}();
        console.log("stake, pool balance:", address(pool).balance);
        vm.roll(block.number + 5);
        pool.updatePool(); // 触发奖励结算
        pool.claim();
        console.log("first claim, userA KK:", pool.kk().balanceOf(userA));
        vm.roll(block.number + 5);
        pool.updatePool(); // 触发奖励结算
        pool.claim();
        console.log("second claim, userA KK:", pool.kk().balanceOf(userA));
        vm.stopPrank();
    }

    function testUnstake() public {
        vm.startPrank(userA);
        pool.stake{value: 2 ether}();
        vm.roll(block.number + 10);
        pool.updatePool(); // 触发奖励结算
        console.log("before unstake, pool balance:", address(pool).balance);
        console.log("before unstake, userA LP:", pool.lp().balanceOf(userA));
        uint256 before = userA.balance;
        pool.unstake(1 ether);
        console.log("after unstake, pool balance:", address(pool).balance);
        console.log("after unstake, userA LP:", pool.lp().balanceOf(userA));
        console.log("after unstake, userA KK:", pool.kk().balanceOf(userA));
        vm.stopPrank();
    }

    function testNoStakeNoReward() public {
        // 没人质押，updatePool不会分配奖励
        pool.updatePool();
        assertEq(pool.acckkPerShare(), 0);
    }

    function testStakeUnstakeImmediately() public {
        vm.startPrank(userA);
        pool.stake{value: 1 ether}();
        console.log("stake, pool balance:", address(pool).balance);
        console.log("stake, userA LP:", pool.lp().balanceOf(userA));
        pool.unstake(1 ether);
        console.log("unstake, pool balance:", address(pool).balance);
        console.log("unstake, userA LP:", pool.lp().balanceOf(userA));
        console.log("unstake, userA KK:", pool.kk().balanceOf(userA));
        vm.stopPrank();
    }

    function testViewFunctions() public {
        vm.startPrank(userA);
        pool.stake{value: 1 ether}();
        console.log("stake, pool balance:", address(pool).balance);
        vm.roll(block.number + 10);
        pool.updatePool(); // 触发奖励结算
        uint earned = pool.earned(userA);
        console.log("earned, userA:", earned);
        vm.stopPrank();
    }

} 