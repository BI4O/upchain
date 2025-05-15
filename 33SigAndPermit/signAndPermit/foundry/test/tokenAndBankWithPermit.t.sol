// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import "../src/tokenAndBankWithPermit.sol";

/**
 * @title MyTokenAndBankTest
 * @notice 测试MyToken和tokenBank合约的功能，特别关注Permit功能
 */
contract MyTokenAndBankTest is Test {
    // 测试合约
    MyToken private token;
    tokenBank private bank;
    
    // 测试账户
    address private deployer;
    address private alice;
    address private bob;
    
    // 测试参数
    uint256 private constant INITIAL_SUPPLY = 1e10;
    uint256 private constant DEPOSIT_AMOUNT = 1000;
    uint256 private constant LARGE_APPROVAL = 2**256 - 1;
    
    /**
     * @notice 设置测试环境
     */
    function setUp() public {
        // 设置测试账户
        deployer = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        
        // 部署合约
        token = new MyToken();
        bank = new tokenBank(address(token));
        
        // 为测试账户分配代币
        token.transfer(alice, 1000000);
        token.transfer(bob, 1000000);
    }
    
    /**
     * @notice 测试代币初始化
     */
    function testTokenInitialization() public {
        assertEq(token.name(), "Ptoken");
        assertEq(token.symbol(), "PET");
        assertEq(token.balanceOf(deployer), INITIAL_SUPPLY - 2000000); // 减去分配给alice和bob的数量
        assertEq(token.balanceOf(alice), 1000000);
        assertEq(token.balanceOf(bob), 1000000);
    }
    
    /**
     * @notice 测试传统的存款方法（需要先approve）
     */
    function testTraditionalDeposit() public {
        // 切换到alice账户
        vm.startPrank(alice);
        
        // 检查初始状态
        assertEq(token.balanceOf(alice), 1000000);
        assertEq(bank.balanceOf(alice), 0);
        
        // alice需要先授权bank合约才能转账
        token.approve(address(bank), DEPOSIT_AMOUNT);
        
        // 然后再进行存款
        bank.deposit(DEPOSIT_AMOUNT);
        
        // 验证结果
        assertEq(token.balanceOf(alice), 1000000 - DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(address(bank)), DEPOSIT_AMOUNT);
        assertEq(bank.balanceOf(alice), DEPOSIT_AMOUNT);
        
        vm.stopPrank();
    }
    
    /**
     * @notice 测试使用Permit进行存款
     * @dev 使用permit签名授权，一步完成授权和存款
     */
    function testDepositWithPermit() public {
        // 切换到bob账户
        vm.startPrank(bob);
        
        // 检查初始状态
        assertEq(token.balanceOf(bob), 1000000);
        assertEq(bank.balanceOf(bob), 0);
        
        // 准备permit参数
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = token.nonces(bob);
        
        // 计算digest (要签名的消息)
        bytes32 digest = _getPermitDigest(
            bob,
            address(bank),
            DEPOSIT_AMOUNT,
            nonce,
            deadline
        );
        
        // bob对digest进行签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256(abi.encodePacked("bob"))), digest);
        
        // 使用permit直接存款，无需先approve
        bank.depositWithPermit(
            bob,
            DEPOSIT_AMOUNT,
            deadline,
            v, r, s
        );
        
        // 验证结果
        assertEq(token.balanceOf(bob), 1000000 - DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(address(bank)), DEPOSIT_AMOUNT);
        assertEq(bank.balanceOf(bob), DEPOSIT_AMOUNT);
        
        vm.stopPrank();
    }
    
    /**
     * @notice 测试从银行提款
     */
    function testWithdraw() public {
        // 先存款
        vm.startPrank(alice);
        token.approve(address(bank), DEPOSIT_AMOUNT);
        bank.deposit(DEPOSIT_AMOUNT);
        
        // 检查存款后状态
        assertEq(token.balanceOf(alice), 1000000 - DEPOSIT_AMOUNT);
        assertEq(bank.balanceOf(alice), DEPOSIT_AMOUNT);
        
        // 提款
        bank.withdraw();
        
        // 验证提款后状态
        assertEq(token.balanceOf(alice), 1000000);
        assertEq(bank.balanceOf(alice), 0);
        
        vm.stopPrank();
    }
    
    /**
     * @notice 测试第三方使用permit代表用户存款
     * @dev 这展示了permit的一个重要用例：代表用户执行操作
     */
    function testThirdPartyDepositWithPermit() public {
        // bob准备签名
        vm.startPrank(bob);
        
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = token.nonces(bob);
        
        // 计算digest
        bytes32 digest = _getPermitDigest(
            bob,
            address(bank),
            DEPOSIT_AMOUNT,
            nonce,
            deadline
        );
        
        // bob签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256(abi.encodePacked("bob"))), digest);
        vm.stopPrank();
        
        // 验证初始状态
        assertEq(token.balanceOf(bob), 1000000);
        assertEq(bank.balanceOf(bob), 0);
        
        // alice代表bob执行存款（这是permit的关键优势）
        vm.startPrank(alice);
        bank.depositWithPermit(
            bob,  // 注意：这里是bob的地址，不是alice
            DEPOSIT_AMOUNT,
            deadline,
            v, r, s
        );
        vm.stopPrank();
        
        // 验证结果 - 资金从bob转移到了bank，但操作是由alice执行的
        assertEq(token.balanceOf(bob), 1000000 - DEPOSIT_AMOUNT);
        assertEq(bank.balanceOf(bob), DEPOSIT_AMOUNT);
    }
    
    /**
     * @notice 测试过期的permit
     */
    function testExpiredPermit() public {
        vm.startPrank(bob);
        
        // 先设置当前区块时间
        uint256 currentTime = 1000000;
        vm.warp(currentTime);
        
        // 设置一个已经过期的deadline
        uint256 deadline = currentTime - 1; // 设置为当前时间之前的时间
        uint256 nonce = token.nonces(bob);
        
        bytes32 digest = _getPermitDigest(
            bob,
            address(bank),
            DEPOSIT_AMOUNT,
            nonce,
            deadline
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256(abi.encodePacked("bob"))), digest);
        
        // 尝试使用过期的permit，应该会失败
        // OpenZeppelin最新版本使用自定义错误ERC2612ExpiredSignature
        vm.expectRevert(abi.encodeWithSignature("ERC2612ExpiredSignature(uint256)", deadline));
        bank.depositWithPermit(
            bob,
            DEPOSIT_AMOUNT,
            deadline,
            v, r, s
        );
        
        vm.stopPrank();
    }
    
    /**
     * @notice 生成permit签名的digest
     */
    function _getPermitDigest(
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) private view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        owner,
                        spender,
                        value,
                        nonce,
                        deadline
                    )
                )
            )
        );
    }
} 