// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "lib/forge-std/src/Test.sol";
import "src/options.sol";
import "lib/openzeppelin-contracts/contracts/mocks/token/ERC20Mock.sol";

contract CallOptionTest is Test {
    CallOption public option;
    ERC20Mock public usdt;
    ERC20Mock public asset;
    address public owner = address(this);
    address public user = address(0x1);

    function setUp() public {
        // 部署模拟USDT和标的资产
        usdt = new ERC20Mock();
        asset = new ERC20Mock();
        // 给owner和user铸造初始资产
        asset.mint(owner, 1000 ether);
        usdt.mint(user, 10000 ether);
        // 部署期权合约
        option = new CallOption();
    }

    function testCreateOption() public {
        // owner授权期权合约转移标的资产
        asset.approve(address(option), 100 ether);
        // 创建期权
        option.createOption(100 ether, block.timestamp + 1 days, address(asset), address(usdt), 100 ether);
        assertEq(option.balanceOf(owner), 100 ether, "option token mint failed");
        assertEq(asset.balanceOf(address(option)), 100 ether, "underlying asset not transferred");
    }

    function testExercise() public {
        // 创建期权
        asset.approve(address(option), 100 ether);
        option.createOption(10 ether, block.timestamp + 1 days, address(asset), address(usdt), 100 ether);
        // owner转一部分期权Token给user
        option.transfer(user, 10 ether);
        // user授权期权合约转移USDT
        vm.prank(user);
        usdt.approve(address(option), 100 ether);
        // user行权
        vm.prank(user);
        option.exercise(5 ether);
        // 检查user获得标的资产
        assertEq(asset.balanceOf(user), 5 ether, "user did not receive asset");
        // 检查user期权Token减少
        assertEq(option.balanceOf(user), 5 ether, "user option token not reduced");
        // 检查owner收到USDT
        assertEq(usdt.balanceOf(owner), 50 ether, "owner did not receive USDT");
    }

    function testExpireOption() public {
        // 创建期权
        asset.approve(address(option), 100 ether);
        option.createOption(10 ether, block.timestamp + 1 days, address(asset), address(usdt), 100 ether);
        // 时间快进到到期后
        vm.warp(block.timestamp + 2 days);
        // owner赎回剩余标的资产
        uint256 before = asset.balanceOf(owner);
        option.expireOption();
        uint256 after_ = asset.balanceOf(owner);
        assertEq(after_ - before, 100 ether, "owner did not redeem asset");
    }

    function testCannotExerciseAfterExpire() public {
        // 创建期权
        asset.approve(address(option), 100 ether);
        option.createOption(10 ether, block.timestamp + 1 days, address(asset), address(usdt), 100 ether);
        option.transfer(user, 10 ether);
        vm.prank(user);
        usdt.approve(address(option), 100 ether);
        // 时间快进到到期后
        vm.warp(block.timestamp + 2 days);
        // user尝试行权应失败
        vm.prank(user);
        vm.expectRevert("Option expired");
        option.exercise(1 ether);
    }

    function testCannotCreateTwice() public {
        asset.approve(address(option), 100 ether);
        option.createOption(10 ether, block.timestamp + 1 days, address(asset), address(usdt), 100 ether);
        asset.approve(address(option), 100 ether);
        vm.expectRevert("Option already created");
        option.createOption(10 ether, block.timestamp + 2 days, address(asset), address(usdt), 100 ether);
    }
} 