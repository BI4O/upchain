pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Bank} from "../src/BankGetTop3.sol";

/*
1.断言检查存款前后用户在 Bank 合约中的存款额更新是否正确。
2.检查存款金额的前 3 名用户是否正确，分别检查有1个、2个、3个、4 个用户， 以及同一个用户多次存款的情况。
3.检查只有管理员可取款，其他人不可以取款。
*/

contract BankTest is Test {
    // 合约类型
    Bank public bank;
    address public owner;
    uint public numberOfDonors = 10;
    address[] public donors;

    // 添加receive函数来接收ETH
    receive() external payable {}

    function setUp() public {
        bank = new Bank();
        owner = bank.owner();
        // 给测试合约一些ETH
        vm.deal(address(this), 100 ether);
        // 给owner地址一些ETH
        vm.deal(owner, 100 ether);
        // 随机生成10个不同的地址，每个地址给一点钱
        for (uint i = 1; i <= numberOfDonors; i++) {
            address d = vm.addr(i);
            donors.push(d);
            vm.deal(d, 10 ether);
        }
    }

    // 一、存多少就有多少余额
    function testFuzzFirst3Deposits(uint amount) public {
        // 随机变化数字
        uint randomAmount = bound(amount, 1, 1e10);

        // 选第一个用户
        address d = donors[0];

        // 存进去
        vm.prank(d);
        (bool ok,) = address(bank).call{value: randomAmount}("");
        require(ok, "deposit failed !");
        uint balanceOfd = bank.addr2money(d);

        // 验证银行余额
        assertEq(balanceOfd, randomAmount);
    }

    // 二、检查余额前三名是否准确
    function testGetTop3() public {
        // 场景1：只有一个捐赠者
        vm.startPrank(donors[0]);
        (bool ok1,) = address(bank).call{value: 1 ether}("");
        require(ok1, "deposit failed!");
        vm.stopPrank();
        
        address[3] memory top3 = bank.getTop3Donors();
        assertEq(top3[0], donors[0], "First donor should be donors[0]");
        assertEq(top3[1], address(0), "Second position should be empty");
        assertEq(top3[2], address(0), "Third position should be empty");

        // 场景2：两个捐赠者，金额不同
        vm.startPrank(donors[1]);
        (bool ok2,) = address(bank).call{value: 2 ether}("");
        require(ok2, "deposit failed!");
        vm.stopPrank();
        
        top3 = bank.getTop3Donors();
        assertEq(top3[0], donors[1], "First donor should be donors[1]");
        assertEq(top3[1], donors[0], "Second donor should be donors[0]");
        assertEq(top3[2], address(0), "Third position should be empty");

        // 场景3：三个捐赠者，金额不同
        vm.startPrank(donors[2]);
        (bool ok3,) = address(bank).call{value: 3 ether}("");
        require(ok3, "deposit failed!");
        vm.stopPrank();
        
        top3 = bank.getTop3Donors();
        assertEq(top3[0], donors[2], "First donor should be donors[2]");
        assertEq(top3[1], donors[1], "Second donor should be donors[1]");
        assertEq(top3[2], donors[0], "Third donor should be donors[0]");

        // 场景4：第四个捐赠者金额不足以进入前三
        vm.startPrank(donors[3]);
        (bool ok4,) = address(bank).call{value: 0.5 ether}("");
        require(ok4, "deposit failed!");
        vm.stopPrank();
        
        top3 = bank.getTop3Donors();
        assertEq(top3[0], donors[2], "First donor should still be donors[2]");
        assertEq(top3[1], donors[1], "Second donor should still be donors[1]");
        assertEq(top3[2], donors[0], "Third donor should still be donors[0]");

        // 场景5：第四个捐赠者金额超过第三名
        vm.startPrank(donors[3]);
        (bool ok5,) = address(bank).call{value: 1.5 ether}("");
        require(ok5, "deposit failed!");
        vm.stopPrank();
        
        top3 = bank.getTop3Donors();
        assertEq(top3[0], donors[2], "First donor should still be donors[2]");
        assertEq(top3[1], donors[1], "Second donor should still be donors[1]");
        assertEq(top3[2], donors[3], "Third donor should now be donors[3]");

        // 场景6：同一个捐赠者多次捐赠
        vm.startPrank(donors[0]);
        (bool ok6,) = address(bank).call{value: 4 ether}("");
        require(ok6, "deposit failed!");
        vm.stopPrank();
        
        top3 = bank.getTop3Donors();
        assertEq(top3[0], donors[0], "First donor should now be donors[0]");
        assertEq(top3[1], donors[2], "Second donor should now be donors[2]");
        assertEq(top3[2], donors[1], "Third donor should now be donors[1]");
    }

    // 三、只有owner可以回收Bank里面的所有钱
    function testWithdraw() public {
        // 1. 让所有捐赠者都存入一些钱
        for (uint i = 0; i < numberOfDonors; i++) {
            vm.startPrank(donors[i]);
            (bool ok,) = address(bank).call{value: 1 ether}("");
            require(ok, "deposit failed!");
            vm.stopPrank();
        }

        // 2. 验证银行余额
        uint bankBalanceBefore = bank.bankBalance();
        assertEq(bankBalanceBefore, numberOfDonors * 1 ether, "Bank balance should be correct");

        // 3. 非owner尝试取款（应该失败）
        for (uint i = 0; i < numberOfDonors; i++) {
            vm.startPrank(donors[i]);
            vm.expectRevert("not owner");
            bank.withdraw();
            vm.stopPrank();
        }

        // 4. owner取款（应该成功）
        uint ownerBalanceBefore = owner.balance;
        vm.startPrank(owner);
        bank.withdraw();
        vm.stopPrank();

        // 5. 验证银行余额变为0
        assertEq(bank.bankBalance(), 0, "Bank balance should be 0 after withdrawal");

        // 6. 验证owner收到了所有钱
        uint ownerBalanceAfter = owner.balance;
        assertEq(
            ownerBalanceAfter - ownerBalanceBefore,
            bankBalanceBefore,
            "Owner should receive all the money"
        );
    }
}