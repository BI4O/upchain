// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RebaseStableCoin.sol";
import {console} from "forge-std/console.sol";

contract RebaseStableCoinTest is Test {
    StableCoin stableCoin;
    address user1 = address(0x1);
    address user2 = address(0x2);
    address user3 = address(0x3);

    function setUp() public {
        stableCoin = new StableCoin();
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
    }

    function testMintAndBalance() public {
        vm.prank(user1);
        stableCoin.mint{value: 10 ether}();
        assertEq(stableCoin.balanceOf(user1), 10 ether);

        vm.prank(user2);
        stableCoin.mint{value: 20 ether}();
        assertEq(stableCoin.balanceOf(user2), 20 ether);
    }

    function testTransfer() public {
        vm.prank(user1);
        stableCoin.mint{value: 10 ether}();

        vm.prank(user1);
        stableCoin.transfer(user2, 3 ether);

        assertEq(stableCoin.balanceOf(user1), 7 ether);
        assertEq(stableCoin.balanceOf(user2), 3 ether);
    }

    function testApproveAndTransferFrom() public {
        vm.prank(user1);
        stableCoin.mint{value: 10 ether}();

        vm.prank(user1);
        stableCoin.approve(user3, 5 ether);

        vm.prank(user3);
        stableCoin.transferFrom(user1, user2, 4 ether);

        assertEq(stableCoin.balanceOf(user1), 6 ether);
        assertEq(stableCoin.balanceOf(user2), 4 ether);
        assertEq(stableCoin.allowance(user1, user3), 1 ether);
    }

    function testRebaseIncreasesBalance() public {
        vm.prank(user1);
        stableCoin.mint{value: 10 ether}();
        vm.prank(user2);
        stableCoin.mint{value: 20 ether}();

        uint y1_before = stableCoin.balanceOf(user1);
        uint y2_before = stableCoin.balanceOf(user2);

        // 时间快进一年
        uint before_k = stableCoin.k();
        vm.warp(block.timestamp + 366 days);
        stableCoin.rebase();
        console.log("rebase before K: ", before_k);
        console.log("rebase after  K:  ",stableCoin.k());

        uint y1_after = stableCoin.balanceOf(user1);
        uint y2_after = stableCoin.balanceOf(user2);

        assertGt(y1_before, y1_after);
        assertGt(y2_before, y2_after);
        console.log("y1 balance before:",y1_before, "=> after: ", y1_after);
        console.log("y2 balance bedore:",y2_before, "=> after: ", y2_after);
    }

    function testTransferAfterRebase() public {
        vm.prank(user1);
        stableCoin.mint{value: 10 ether}();
        vm.prank(user2);
        stableCoin.mint{value: 20 ether}();

        // rebase
        vm.warp(block.timestamp + 366 days);
        stableCoin.rebase();

        // 转账
        uint y1_before = stableCoin.balanceOf(user1);
        vm.prank(user1);
        stableCoin.transfer(user2, 5 ether);

        // 转账后余额
        assertEq(stableCoin.balanceOf(user1), y1_before - 5 ether);
        // user2余额增加
        assertGt(20 ether + 5 ether, stableCoin.balanceOf(user2)); // 允许1wei误差
    }

    function testApproveAndTransferFromAfterRebase() public {
        vm.prank(user1);
        stableCoin.mint{value: 10 ether}();

        // rebase
        vm.warp(block.timestamp + 366 days);
        stableCoin.rebase();

        vm.prank(user1);
        stableCoin.approve(user3, 5 ether);

        vm.prank(user3);
        stableCoin.transferFrom(user1, user2, 4 ether);

        assertApproxEqAbs(stableCoin.allowance(user1, user3), 1 ether, 1); // 允许1 wei误差
        assertApproxEqAbs(stableCoin.balanceOf(user2), 4 ether, 1); // 允许1 wei误差
    }
}