// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/dao.sol";
import "forge-std/console.sol";

contract DaoTest is Test {
    Gov gov;
    Token token;
    Bank bank;
    address alice = vm.addr(1);
    address bob = vm.addr(2);
    address carol = vm.addr(3);

    function setUp() public {
        gov = new Gov();
        token = gov.token();
        bank = gov.bank();
        // 给alice和bob发token
        token.mint(alice, 100);
        token.mint(bob, 50);
        // 给bank充点ETH（先给本合约分配余额，再转账给bank）
        vm.deal(address(this), 100 ether);
        (bool sent, ) = address(bank).call{value: 10 ether}("");
        require(sent, "send ETH to bank failed");
    }

    function testProposeAndVoteAndExecute() public {
        console.log("--- testProposeAndVoteAndExecute ---");
        console.log("Initial block timestamp:", block.timestamp);

        // 发起提案
        vm.prank(alice);
        gov.propose_withdraw(block.timestamp + 100);
        console.log("Proposal proposed by", alice, "at timestamp", block.timestamp);

        // 记录提案截止时间
        (uint id, uint agree, uint disagree, uint abstain, uint deadline, uint startAtBlockNum, bool executed) = gov.latestProposal();
        console.log("Proposal ID:", id);
        console.log("Proposal deadline:", deadline);
        console.log("Proposal startBlock:", startAtBlockNum);
        console.log("Proposal executed:", executed);

        assertEq(id, 1);
        assertEq(startAtBlockNum, block.number); // startBlock应该是提案时的区块
        assertEq(executed, false);

        // 推进区块，确保投票发生在提案后的区块
        vm.warp(block.timestamp + 1);
        vm.roll(block.number + 1);
        console.log("Block timestamp after first warp:", block.timestamp);
        console.log("Block number after first roll:", block.number);

        // alice投同意票
        console.log("Alice voting 'agree'");
        vm.prank(alice);
        gov.vote(0);
        (, agree, , , , , ) = gov.latestProposal();
        console.log("Alice voted. Current agree:", agree);
        assertEq(agree, 100);

        // bob投反对票
        console.log("Bob voting 'disagree'");
        vm.prank(bob);
        gov.vote(1);
        ( , , disagree, , , , ) = gov.latestProposal();
        console.log("Bob voted. Current disagree:", disagree);
        assertEq(disagree, 50);

        // carol没票权，投票应revert
        console.log("Carol voting (expect revert 'No voting power at snapshot')");
        vm.prank(carol);
        vm.expectRevert("No voting power at snapshot");
        gov.vote(0);
        console.log("Carol voting reverted as expected");

        // alice重复投票应revert
        console.log("Alice voting again (expect revert 'Already voted')");
        vm.prank(alice);
        vm.expectRevert("Already voted");
        gov.vote(0);
        console.log("Alice voting again reverted as expected");

        // 截止前不能执行
        console.log("Attempting execution before deadline");
        vm.expectRevert("Voting not ended");
        gov.execute_withdraw();
        console.log("Execution before deadline reverted as expected");

        // 推进到截止后
        console.log("Warping time past deadline");
        vm.warp(deadline + 1); // Warp directly past the proposal deadline using recorded deadline
        console.log("Current block timestamp after second warp:", block.timestamp);

        // 执行成功
        console.log("Attempting execution after deadline");
        gov.execute_withdraw();
        console.log("Execution successful");
        ( , , , , , , executed) = gov.latestProposal();
        console.log("Proposal executed status:", executed);
        assertTrue(executed);

        // 再次执行应revert
        console.log("Attempting execution again (expect revert 'Already executed')");
        vm.expectRevert("Already executed");
        gov.execute_withdraw();
        console.log("Execution again reverted as expected");
        console.log("--- End testProposeAndVoteAndExecute ---");
    }

    function testProposeWhenActiveProposal() public {
        // 发起提案
        vm.prank(alice);
        gov.propose_withdraw(block.timestamp + 100);
        // 再发起应revert
        vm.prank(bob);
        vm.expectRevert("There is an active proposal");
        gov.propose_withdraw(block.timestamp + 200);
    }

    function testProposeAfterExecuted() public {
        console.log("--- testProposeAfterExecuted ---");
        console.log("Initial block timestamp:", block.timestamp);

        // 发起提案
        vm.prank(alice);
        gov.propose_withdraw(block.timestamp + 100);
        console.log("Proposal 1 proposed by", alice, "at timestamp", block.timestamp);

        // 记录提案截止时间
        (uint id, , , , uint deadline, , ) = gov.latestProposal();
        console.log("Proposal 1 ID:", id);
        console.log("Proposal 1 deadline:", deadline);

        // 推进区块并投票，确保提案有足够同意票
        vm.warp(block.timestamp + 1);
        vm.roll(block.number + 1);
        console.log("Warped time for voting:", block.timestamp);
        console.log("Block number after roll:", block.number);

        vm.prank(alice);
        gov.vote(0); // Alice votes agree (100 votes)
        console.log("Alice voted agree");
        vm.prank(bob);
        gov.vote(1); // Bob votes disagree (50 votes)
        console.log("Bob voted disagree");

        ( , uint agree, uint disagree, , , , ) = gov.latestProposal();
        console.log("Proposal 1 Agree votes:", agree);
        console.log("Proposal 1 Disagree votes:", disagree);

        // 推进到截止后
        console.log("Warping time past deadline of Proposal 1");
        vm.warp(deadline + 1); // Warp past the recorded deadline
        console.log("Current block timestamp after warp:", block.timestamp);

        // 执行
        console.log("Executing Proposal 1");
        gov.execute_withdraw();
        console.log("Proposal 1 executed");
        (,, , , , , bool executed) = gov.latestProposal();
        console.log("Proposal 1 executed status:", executed);
        assertTrue(executed);

        // 再发起新提案
        console.log("Proposing Proposal 2 after execution of Proposal 1");
        vm.prank(bob);
        gov.propose_withdraw(block.timestamp + 200);
        console.log("Proposal 2 proposed by", bob, "at timestamp", block.timestamp);
        (id, , , , , , ) = gov.latestProposal();
        console.log("Proposal 2 ID:", id);
        assertEq(id, 2);
        console.log("--- End testProposeAfterExecuted ---");
    }

    function testSnapshotVotes() public {
        console.log("--- testSnapshotVotes ---");
        console.log("Initial block timestamp:", block.timestamp);

        // 发起提案
        vm.prank(alice);
        gov.propose_withdraw(block.timestamp + 100);
        console.log("Proposal proposed by", alice, "at timestamp", block.timestamp);

        // 推进区块，确保投票发生在提案后的区块
        vm.warp(block.timestamp + 1);
        vm.roll(block.number + 1);
        console.log("Block timestamp after warp:", block.timestamp);
        console.log("Block number after roll:", block.number);

        (uint id, , , , , uint startAtBlockNum, ) = gov.latestProposal();
        console.log("Proposal ID:", id);
        console.log("Proposal startBlock:", startAtBlockNum);

        // alice转账给bob
        console.log("Alice transferring 50 tokens to Bob");
        vm.prank(alice);
        token.transfer(bob, 50);
        console.log("Alice balance after transfer:", token.balanceOf(alice));
        console.log("Bob balance after transfer:", token.balanceOf(bob));

        // alice投票，快照票数应为100
        console.log("Alice voting 'agree' based on snapshot at block", startAtBlockNum);
        console.log("Alice's votes at snapshot:", token.getPriorVotes(alice, startAtBlockNum));
        vm.prank(alice);
        gov.vote(0);
        (, uint agree, , , , , ) = gov.latestProposal();
        console.log("Alice voted. Current agree:", agree);
        assertEq(agree, 100);

        // bob投票，快照票数应为50（mint时的）
        console.log("Bob voting 'agree' based on snapshot at block", startAtBlockNum);
        console.log("Bob's votes at snapshot:", token.getPriorVotes(bob, startAtBlockNum));
        vm.prank(bob);
        gov.vote(0);
        (, agree, , , , , ) = gov.latestProposal();
        console.log("Bob voted. Current agree:", agree);
        assertEq(agree, 150);
        console.log("--- End testSnapshotVotes ---");
    }
}