// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RebaseStableCoin.sol";
import {console} from "forge-std/console.sol";

contract RebaseStableCoinTest is Test {
    StableCoin stableCoin;
    address user1 = address(0x1);
    address user2 = address(0x2);

    function setUp() public {
        stableCoin = new StableCoin();
    }

    function testRebaseIncreasesBalanceOf() public {
        // user1 和 user2 分别 mint 一定数量
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);

        vm.prank(user1);
        stableCoin.mint{value: 10 ether}();

        vm.prank(user2);
        stableCoin.mint{value: 20 ether}();

        // 记录初始余额
        uint y1_before = stableCoin.balanceOf(user1);
        uint y2_before = stableCoin.balanceOf(user2);
        uint rebaseTimes = stableCoin.rebaseTimes();
        uint k = stableCoin.k();
        console.log("before K", k);

        // 时间快进一年
        vm.warp(block.timestamp + 365 days);

        // 触发rebase
        stableCoin.rebase();
        console.log("after K", stableCoin.k());
        assertGt(stableCoin.rebaseTimes(), rebaseTimes);
        assertGt(k, stableCoin.k());

        // 记录rebase后的余额
        uint y1_after = stableCoin.balanceOf(user1);
        uint y2_after = stableCoin.balanceOf(user2);

        // 断言余额变大
        assertGt(y1_after, y1_before);
        assertGt(y2_after, y2_before);

        // 打印结果方便调试
        emit log_named_uint("user1 before", y1_before);
        emit log_named_uint("user1 after", y1_after);
        emit log_named_uint("user2 before", y2_before);
        emit log_named_uint("user2 after", y2_after);
    }
}