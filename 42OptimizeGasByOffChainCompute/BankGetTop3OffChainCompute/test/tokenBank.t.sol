// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {TokenBank} from "../src/tokenBank.sol";
import {MyToken} from "../src/token.sol";

contract TokenBankTest is Test {
    TokenBank public bank;
    MyToken public token;
    address[] public users;
    address public constant HEAD = address(1);

    function setUp() public {
        // Create token and bank contracts
        token = new MyToken();
        bank = new TokenBank(address(token));
        
        // Create 15 test user addresses
        for (uint i = 0; i < 15; i++) {
            address user = address(uint160(i + 100));
            users.push(user);
            // Mint 10000 tokens for each user
            token.mint(user, 10000 ether);
            // User approves bank contract
            vm.prank(user);
            token.approve(address(bank), type(uint256).max);
        }
    }

    // Print linked list structure for debugging
    function printLinkedList() public view {
        console.log("Printing linked list structure:");
        address curr = HEAD;
        console.log("HEAD: %s", curr);
        
        address next = bank.nextUser(curr);
        uint count = 0;
        
        while (next != HEAD && count < 20) {
            console.log("  -> %s (balance: %s)", next, bank.balanceOf(next));
            curr = next;
            next = bank.nextUser(curr);
            count++;
        }
        
        console.log("List length: %s", bank.listSize());
    }

    // Helper function: Calculate insertion position
    function findInsertPosition(address user, uint256 newBalance) public view returns (address fromWhom, address toWhom) {
        // If new user
        if (bank.nextUser(user) == address(0)) {
            fromWhom = address(0);
            
            // Find suitable insertion position
            address curr = HEAD;
            address next = bank.nextUser(curr);
            
            while (next != HEAD) {
                if (bank.balanceOf(next) < newBalance) {
                    break;
                }
                curr = next;
                next = bank.nextUser(next);
            }
            
            toWhom = curr;
            return (fromWhom, toWhom);
        } 
        // Existing user
        else {
            // Find node before user
            address prev = HEAD;
            address curr = bank.nextUser(prev);
            
            while (curr != HEAD && curr != user) {
                prev = curr;
                curr = bank.nextUser(curr);
            }
            
            // Ensure user was found
            require(curr == user, "User not found in linked list");
            
            fromWhom = prev;
            
            // If balance becomes 0, no need to reinsert
            if (newBalance == 0) {
                return (fromWhom, address(0));
            }
            
            // Find correct new position
            address insertAfter = HEAD;
            address insertNext = bank.nextUser(insertAfter);
            
            // Traverse linked list to find suitable insertion point
            while (insertNext != HEAD) {
                // Skip user themselves
                if (insertNext == user) {
                    insertAfter = insertNext;
                    insertNext = bank.nextUser(insertNext);
                    continue;
                }
                
                // Find first user with balance less than new balance
                if (bank.balanceOf(insertNext) < newBalance) {
                    break;
                }
                
                insertAfter = insertNext;
                insertNext = bank.nextUser(insertNext);
            }
            
            // If new position is right after old position, no need to move
            if (fromWhom == insertAfter) {
                return (fromWhom, fromWhom);
            }
            
            // If new position is right before user, no need to move
            if (bank.nextUser(insertAfter) == user) {
                return (fromWhom, fromWhom);
            }
            
            toWhom = insertAfter;
            return (fromWhom, toWhom);
        }
    }

    // Test 1: Test deposit function and linked list sorting
    function testDeposit() public {
        // User 0 deposits 1000
        (address fromWhom, address toWhom) = findInsertPosition(users[0], 1000 ether);
        vm.prank(users[0]);
        bank.deposit(1000 ether, fromWhom, toWhom);
        
        // User 1 deposits 2000
        (fromWhom, toWhom) = findInsertPosition(users[1], 2000 ether);
        vm.prank(users[1]);
        bank.deposit(2000 ether, fromWhom, toWhom);
        
        // User 2 deposits 1500
        (fromWhom, toWhom) = findInsertPosition(users[2], 1500 ether);
        vm.prank(users[2]);
        bank.deposit(1500 ether, fromWhom, toWhom);
        
        // Verify balances
        assertEq(bank.balanceOf(users[0]), 1000 ether);
        assertEq(bank.balanceOf(users[1]), 2000 ether);
        assertEq(bank.balanceOf(users[2]), 1500 ether);
        
        // Verify linked list sorting
        address[] memory top3 = bank.getTopDepositors(3);
        assertEq(top3[0], users[1]); // 2000
        assertEq(top3[1], users[2]); // 1500
        assertEq(top3[2], users[0]); // 1000
    }
    
    // Test 2: Test withdrawal function and linked list reordering
    function testWithdraw() public {
        // Initial deposits
        // User 0 deposits 1000
        (address fromWhom, address toWhom) = findInsertPosition(users[0], 1000 ether);
        vm.prank(users[0]);
        bank.deposit(1000 ether, fromWhom, toWhom);
        
        // User 1 deposits 2000
        (fromWhom, toWhom) = findInsertPosition(users[1], 2000 ether);
        vm.prank(users[1]);
        bank.deposit(2000 ether, fromWhom, toWhom);
        
        // User 2 deposits 1500
        (fromWhom, toWhom) = findInsertPosition(users[2], 1500 ether);
        vm.prank(users[2]);
        bank.deposit(1500 ether, fromWhom, toWhom);
        
        // User 1 withdraws 1200, balance becomes 800
        uint256 newBalance = bank.balanceOf(users[1]) - 1200 ether;
        (fromWhom, toWhom) = findInsertPosition(users[1], newBalance);
        vm.prank(users[1]);
        bank.withdraw(1200 ether, fromWhom, toWhom);
        
        // Verify balance
        assertEq(bank.balanceOf(users[1]), 800 ether);
        
        // Verify linked list sorting
        address[] memory top3 = bank.getTopDepositors(3);
        assertEq(top3[0], users[2]); // 1500
        assertEq(top3[1], users[0]); // 1000
        assertEq(top3[2], users[1]); // 800
    }
    
    // Test 3: Test complete withdrawal and removal from linked list
    function testFullWithdraw() public {
        // Initial deposits
        // User 0 deposits 1000
        (address fromWhom, address toWhom) = findInsertPosition(users[0], 1000 ether);
        vm.prank(users[0]);
        bank.deposit(1000 ether, fromWhom, toWhom);
        
        // User 1 deposits 2000
        (fromWhom, toWhom) = findInsertPosition(users[1], 2000 ether);
        vm.prank(users[1]);
        bank.deposit(2000 ether, fromWhom, toWhom);
        
        // User 1 fully withdraws
        (fromWhom, toWhom) = findInsertPosition(users[1], 0);
        vm.prank(users[1]);
        bank.withdraw(2000 ether, fromWhom, toWhom);
        
        // Verify balance
        assertEq(bank.balanceOf(users[1]), 0);
        
        // Verify linked list sorting and length
        assertEq(bank.listSize(), 1);
        address[] memory top = bank.getTopDepositors(1);
        assertEq(top[0], users[0]); // 1000
    }
    
    // Test 4: Test multiple user deposits and top3/top5/top10 lists
    function testMultiUserDeposit() public {
        // 15 users deposit different amounts
        uint256[] memory amounts = new uint256[](15);
        amounts[0] = 5000 ether;
        amounts[1] = 7500 ether;
        amounts[2] = 3200 ether;
        amounts[3] = 9800 ether;
        amounts[4] = 1500 ether;
        amounts[5] = 6300 ether;
        amounts[6] = 4100 ether;
        amounts[7] = 8700 ether;
        amounts[8] = 2600 ether;
        amounts[9] = 7200 ether;
        amounts[10] = 5800 ether;
        amounts[11] = 3700 ether;
        amounts[12] = 9100 ether;
        amounts[13] = 2100 ether;
        amounts[14] = 8200 ether;
        
        // All users deposit
        for (uint i = 0; i < 15; i++) {
            (address fromWhom, address toWhom) = findInsertPosition(users[i], amounts[i]);
            vm.prank(users[i]);
            bank.deposit(amounts[i], fromWhom, toWhom);
        }
        
        // Verify linked list length
        assertEq(bank.listSize(), 15);
        
        // Get top3
        address[] memory top3 = bank.getTopDepositors(3);
        assertEq(top3[0], users[3]); // 9800
        assertEq(top3[1], users[12]); // 9100
        assertEq(top3[2], users[7]); // 8700
        
        // Get top5
        address[] memory top5 = bank.getTopDepositors(5);
        assertEq(top5[0], users[3]); // 9800
        assertEq(top5[1], users[12]); // 9100
        assertEq(top5[2], users[7]); // 8700
        assertEq(top5[3], users[14]); // 8200
        assertEq(top5[4], users[1]); // 7500
        
        // Get top10
        address[] memory top10 = bank.getTopDepositors(10);
        assertEq(top10[0], users[3]); // 9800
        assertEq(top10[1], users[12]); // 9100
        assertEq(top10[2], users[7]); // 8700
        assertEq(top10[3], users[14]); // 8200
        assertEq(top10[4], users[1]); // 7500
        assertEq(top10[5], users[9]); // 7200
        assertEq(top10[6], users[5]); // 6300
        assertEq(top10[7], users[10]); // 5800
        assertEq(top10[8], users[0]); // 5000
        assertEq(top10[9], users[6]); // 4100
    }
    
    // Test 5: Test multiple deposits and withdrawals and linked list ordering
    function testMultipleDepositsAndWithdrawals() public {
        console.log("=== Test started ===");
        
        // Initial deposits
        (address fromWhom, address toWhom) = findInsertPosition(users[0], 1000 ether);
        console.log("User 0 deposit position: from %s to %s", fromWhom, toWhom);
        vm.prank(users[0]);
        bank.deposit(1000 ether, fromWhom, toWhom);
        
        printLinkedList();
        
        (fromWhom, toWhom) = findInsertPosition(users[1], 2000 ether);
        console.log("User 1 deposit position: from %s to %s", fromWhom, toWhom);
        vm.prank(users[1]);
        bank.deposit(2000 ether, fromWhom, toWhom);
        
        printLinkedList();
        
        // Verify initial deposits
        address[] memory initialTop = bank.getTopDepositors(2);
        console.log("Initial Top[0]: %s, Top[1]: %s", initialTop[0], initialTop[1]);
        assertEq(initialTop[0], users[1]); // 2000
        assertEq(initialTop[1], users[0]); // 1000
        
        // User 0 increases deposit
        uint256 newBalance = bank.balanceOf(users[0]) + 1500 ether;
        (fromWhom, toWhom) = findInsertPosition(users[0], newBalance);
        console.log("User 0 increased deposit position: from %s to %s, new balance: %s", fromWhom, toWhom, newBalance);
        vm.prank(users[0]);
        bank.deposit(1500 ether, fromWhom, toWhom);
        
        printLinkedList();
        
        // Verify balances and sorting
        assertEq(bank.balanceOf(users[0]), 2500 ether);
        
        address[] memory top = bank.getTopDepositors(2);
        console.log("New Top[0]: %s, Top[1]: %s", top[0], top[1]);
        assertEq(top[0], users[0]); // 2500
        assertEq(top[1], users[1]); // 2000
        
        // User 1 partially withdraws - manually set the positions
        address user1Prev = HEAD;
        address current = bank.nextUser(user1Prev);
        
        // Find the node before users[1]
        while (current != HEAD && current != users[1]) {
            user1Prev = current;
            current = bank.nextUser(current);
        }
        
        // Make sure we found users[1]
        require(current == users[1], "Could not find user1 in the list");
        
        // Calculate new balance
        newBalance = bank.balanceOf(users[1]) - 500 ether;
        
        // We need user[1] to stay in the same position since new order is still users[0] > users[1]
        console.log("User 1 withdrawal position: from %s to %s, new balance: %s", user1Prev, user1Prev, newBalance);
        vm.prank(users[1]);
        bank.withdraw(500 ether, user1Prev, user1Prev);
        
        printLinkedList();
        
        // Verify balances and sorting
        assertEq(bank.balanceOf(users[1]), 1500 ether);
        
        top = bank.getTopDepositors(2);
        console.log("Final Top[0]: %s, Top[1]: %s", top[0], top[1]);
        assertEq(top[0], users[0]); // 2500
        assertEq(top[1], users[1]); // 1500
        
        console.log("=== Test ended ===");
    }
}

