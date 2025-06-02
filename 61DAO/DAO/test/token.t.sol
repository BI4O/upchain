// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/token.sol";

contract TokenTest is Test {
    Token token;
    address alice = address(0x1);
    address bob = address(0x2);

    function setUp() public {
        token = new Token();
    }

    function testMintCheckpoint() public {
        token.mint(alice, 100);
        // mint后，alice的票数快照应为100
        assertEq(token.getCurrentVotes(alice), 100);
        (uint32 fromBlock, uint96 votes) = token.checkpoints(alice, 0);
        assertEq(votes, 100);
        assertEq(fromBlock, uint32(block.number));
        assertEq(token.numCheckpoints(alice), 1);
    }

    function testTransferCheckpoint() public {
        token.mint(alice, 100);
        // alice转账给bob
        vm.prank(alice);
        token.transfer(bob, 40);
        // alice和bob的票数快照都应被更新
        assertEq(token.getCurrentVotes(alice), 60);
        assertEq(token.getCurrentVotes(bob), 40);
        // mint和transfer在同一区块，alice只有1个checkpoint，bob有1个
        assertEq(token.numCheckpoints(alice), 1);
        assertEq(token.numCheckpoints(bob), 1);
    }

    function testMultipleCheckpoints() public {
        token.mint(alice, 100);
        vm.prank(alice);
        token.transfer(bob, 10);
        vm.roll(block.number + 1); // 推进区块高度
        vm.prank(alice);
        token.transfer(bob, 20);
        // alice应有2个checkpoint（mint+新块转账），bob有2个（第一次收到+新块收到）
        assertEq(token.numCheckpoints(alice), 2);
        assertEq(token.numCheckpoints(bob), 2);
    }

    function testGetPriorVotes() public {
        token.mint(alice, 100);
        uint block1 = block.number;
        vm.roll(block.number + 1);
        vm.prank(alice);
        token.transfer(bob, 30);
        uint block2 = block.number;
        vm.roll(block.number + 1); // 推进到下一个区块，保证block2 < block.number
        // 查询历史区块的票数
        assertEq(token.getPriorVotes(alice, block1), 100);
        assertEq(token.getPriorVotes(bob, block1), 0);
        assertEq(token.getPriorVotes(alice, block2), 70);
        assertEq(token.getPriorVotes(bob, block2), 30);
    }

    function testGetCurrentVotesEqualsBalance() public {
        token.mint(alice, 77);
        assertEq(token.getCurrentVotes(alice), token.balanceOf(alice));
        vm.prank(alice);
        token.transfer(bob, 7);
        assertEq(token.getCurrentVotes(alice), token.balanceOf(alice));
        assertEq(token.getCurrentVotes(bob), token.balanceOf(bob));
    }
}
