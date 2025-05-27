// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/vasting.sol";

contract VastingTest is Test {
    Token token;
    Vasting vasting;
    address owner = address(0x1);
    address[] beneficiaries;
    address b1 = address(0x2);
    address b2 = address(0x3);

    function setUp() public {
        vm.startPrank(owner);
        token = new Token();
        beneficiaries.push(b1);
        beneficiaries.push(b2);
        vasting = new Vasting(address(token), beneficiaries);
        // 先授权
        token.approve(address(vasting), 1e6 ether);
        // 注入资金并初始化
        vasting.inject();
        vm.stopPrank();
    }

    function testCannotReleaseDuringCliff() public {
        vm.startPrank(b1);
        vm.expectRevert("No release during cliff time!");
        vasting.release();
        vm.stopPrank();
    }

    function testReleaseAfterCliff() public {
        vm.warp(vasting.deploytime() + 12 * 30 days);
        uint256 before1 = token.balanceOf(b1);
        uint256 before2 = token.balanceOf(b2);
        vasting.release();
        uint256 expected = vasting.releaseAmountForEach() / beneficiaries.length;
        assertEq(token.balanceOf(b1) - before1, expected);
        assertEq(token.balanceOf(b2) - before2, expected);
    }

    function testMultiPeriodRelease() public {
        vm.warp(vasting.deploytime() + 15 * 30 days);
        uint256 before1 = token.balanceOf(b1);
        uint256 before2 = token.balanceOf(b2);
        vasting.release();
        uint256 expected = (vasting.releaseAmountForEach() * 4) / beneficiaries.length;
        assertEq(token.balanceOf(b1) - before1, expected);
        assertEq(token.balanceOf(b2) - before2, expected);
    }

    function testCannotReleaseAfterAllReleased() public {
        vm.warp(vasting.deploytime() + (12 + 24) * 30 days);
        vasting.release();
        vm.expectRevert("All release done");
        vasting.release();
    }
}
