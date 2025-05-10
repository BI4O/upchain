// SPDX-License-Identifier: UNLICENSED
// 指定许可证类型为UNLICENSED，表示该合约没有开源许可

pragma solidity ^0.8.13;
// 指定Solidity编译器版本为0.8.13或更高版本

/**
 * @title Counter
 * @dev 一个简单的计数器合约，用于演示基本的Solidity功能
 * 该合约允许设置、增加计数器的值
 */
contract Counter {
    // 状态变量，用于存储计数器的当前值
    // public修饰符自动创建一个getter函数，允许外部读取该值
    uint256 public counter;

    /**
     * @dev 设置计数器的值
     * @param newNumber 要设置的新值
     */
    function setNumber(uint256 newNumber) public {
        counter = newNumber;
    }

    /**
     * @dev 使用自增运算符(++)将计数器值加1
     */
    function increment() public {
        counter++;
    }

    /**
     * @dev 使用加法运算将计数器值加1
     * 注意：此函数功能与increment()相同，只是实现方式不同
     */
    function count() public {
        counter = counter + 1;
    }
}
