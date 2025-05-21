// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/Counter.sol";

// 创建一个新版本的Counter
contract CounterV2 {
    uint256 public count;
    
    // 与原版相同的函数
    function get() public view returns(uint256) {return count;}
    function add(uint256 n) public {count += n;}
    
    // 新增的函数
    function subtract(uint256 n) public {
        require(count >= n, "Cannot result in negative value");
        count -= n;
    }
}

contract CounterTest is Test {
    Counter counter;
    CounterV2 counterV2;
    CounterProxy proxy;
    
    address deployer = address(1);
    
    function setUp() public {
        // 使用特定地址部署合约
        vm.startPrank(deployer);
        
        // 部署原始Counter合约
        counter = new Counter();
        
        // 部署代理合约
        proxy = new CounterProxy();
        
        // 设置代理的实现为Counter
        proxy.updateImpl(address(counter));
        
        vm.stopPrank();
    }
    
    function testInitialImplementation() public {
        assertEq(proxy.get(), 0, "Initial count should be 0");
        
        // 添加一些值
        proxy.add(5);
        assertEq(proxy.get(), 5, "Count should be 5 after adding 5");
        
        // 再添加一些值
        proxy.add(3);
        assertEq(proxy.get(), 8, "Count should be 8 after adding 3 more");
    }
    
    function testUpgrade() public {
        // 先添加一些值
        proxy.add(10);
        assertEq(proxy.get(), 10, "Count should be 10 after adding 10");
        
        // 部署新版本合约
        vm.startPrank(deployer);
        counterV2 = new CounterV2();
        
        // 更新代理指向新实现
        proxy.updateImpl(address(counterV2));
        vm.stopPrank();
        
        // 验证现有功能仍然工作
        assertEq(proxy.get(), 10, "Count should remain 10 after upgrade");
        
        // 添加一些值
        proxy.add(5);
        assertEq(proxy.get(), 15, "Count should be 15 after adding 5");
        
        // 使用普通函数调用方式，不使用汇编
        address proxyAddress = address(proxy);
        bytes memory subtractCall = abi.encodeWithSignature("subtract(uint256)", 3);
        (bool success,) = proxyAddress.call(subtractCall);
        
        assertTrue(success, "Subtract call should succeed");
        
        // 验证结果
        assertEq(proxy.get(), 12, "Count should be 12 after subtracting 3");
    }
} 