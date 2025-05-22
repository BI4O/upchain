// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import "../src/tokenAndBankWithPermit.sol";
import { Permit2 } from "permit2/src/Permit2.sol";
import "permit2/src/interfaces/IPermit2.sol"; // permit2 需要
import "permit2/src/interfaces/ISignatureTransfer.sol"; // permit2 需要

/**
 * @title MyTokenAndBankTest
 * @notice 测试MyToken和tokenBank合约的功能，特别关注Permit2功能
 */
contract MyTokenAndBankTest is Test {
    // 测试合约
    MyToken private token;
    tokenBank private bank;
    Permit2 private permit2;
    
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
        permit2 = new Permit2();
        bank = new tokenBank(address(token), address(permit2));
        
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
     * @notice 测试使用Permit2进行存款
     * @dev 使用permit2签名授权，一步完成授权和存款
     */
    function testDepositWithPermit2() public {
        // 切换到bob账户
        vm.startPrank(bob);
        // 授权Permit2合约
        token.approve(address(permit2), DEPOSIT_AMOUNT);
        
        // 检查初始状态
        assertEq(token.balanceOf(bob), 1000000);
        assertEq(bank.balanceOf(bob), 0);
        
        // 准备permit2参数
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = 0; // permit2 nonce 建议由前端或合约管理
        
        // 构造 permit2 结构体
        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: address(token),
                amount: DEPOSIT_AMOUNT
            }),
            nonce: nonce,
            deadline: deadline
        });
        ISignatureTransfer.SignatureTransferDetails memory transferDetails = ISignatureTransfer.SignatureTransferDetails({
            to: address(bank),
            requestedAmount: DEPOSIT_AMOUNT
        });
        // 正确生成 EIP-712 digest
        bytes32 tokenPermissionsHash = keccak256(abi.encode(
            keccak256("TokenPermissions(address token,uint256 amount)"),
            address(token),
            DEPOSIT_AMOUNT
        ));
        bytes32 structHash = keccak256(abi.encode(
            keccak256("PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"),
            tokenPermissionsHash,
            address(bank),
            nonce,
            deadline
        ));
        bytes32 domainSeparator = permit2.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        // bob签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256(abi.encodePacked("bob"))), digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        bank.depositWithPermit2(
            bob,
            DEPOSIT_AMOUNT,
            deadline,
            signature
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
     * @notice 测试第三方使用permit2代表用户存款
     * @dev 这展示了permit2的一个重要用例：代表用户执行操作
     */
    function testThirdPartyDepositWithPermit2() public {
        // bob准备签名
        vm.startPrank(bob);
        // 授权Permit2合约
        token.approve(address(permit2), DEPOSIT_AMOUNT);
        
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = 0;
        
        // 构造 permit2 结构体
        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: address(token),
                amount: DEPOSIT_AMOUNT
            }),
            nonce: nonce,
            deadline: deadline
        });
        ISignatureTransfer.SignatureTransferDetails memory transferDetails = ISignatureTransfer.SignatureTransferDetails({
            to: address(bank),
            requestedAmount: DEPOSIT_AMOUNT
        });
        // 正确生成 EIP-712 digest
        bytes32 tokenPermissionsHash = keccak256(abi.encode(
            keccak256("TokenPermissions(address token,uint256 amount)"),
            address(token),
            DEPOSIT_AMOUNT
        ));
        bytes32 structHash = keccak256(abi.encode(
            keccak256("PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"),
            tokenPermissionsHash,
            address(bank),
            nonce,
            deadline
        ));
        bytes32 domainSeparator = permit2.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        // bob签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256(abi.encodePacked("bob"))), digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        vm.stopPrank();
        
        // 验证初始状态
        assertEq(token.balanceOf(bob), 1000000);
        assertEq(bank.balanceOf(bob), 0);
        
        // alice代表bob执行存款（这是permit2的关键优势）
        vm.startPrank(alice);
        bank.depositWithPermit2(
            bob,
            DEPOSIT_AMOUNT,
            deadline,
            signature
        );
        vm.stopPrank();
        
        // 验证结果 - 资金从bob转移到了bank，但操作是由alice执行的
        assertEq(token.balanceOf(bob), 1000000 - DEPOSIT_AMOUNT);
        assertEq(bank.balanceOf(bob), DEPOSIT_AMOUNT);
    }
    
    /**
     * @notice 测试过期的permit2
     */
    function testExpiredPermit2() public {
        vm.startPrank(bob);
        // 授权Permit2合约
        token.approve(address(permit2), DEPOSIT_AMOUNT);
        
        // 先设置当前区块时间
        uint256 currentTime = 1000000;
        vm.warp(currentTime);
        
        // 设置一个已经过期的deadline
        uint256 deadline = currentTime - 1; // 设置为当前时间之前的时间
        uint256 nonce = 0;
        
        // 构造 permit2 结构体
        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: address(token),
                amount: DEPOSIT_AMOUNT
            }),
            nonce: nonce,
            deadline: deadline
        });
        ISignatureTransfer.SignatureTransferDetails memory transferDetails = ISignatureTransfer.SignatureTransferDetails({
            to: address(bank),
            requestedAmount: DEPOSIT_AMOUNT
        });
        
        // 正确生成 EIP-712 digest
        bytes32 tokenPermissionsHash = keccak256(abi.encode(
            keccak256("TokenPermissions(address token,uint256 amount)"),
            address(token),
            DEPOSIT_AMOUNT
        ));
        bytes32 structHash = keccak256(abi.encode(
            keccak256("PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"),
            tokenPermissionsHash,
            address(bank),
            nonce,
            deadline
        ));
        bytes32 domainSeparator = permit2.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        // bob签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(keccak256(abi.encodePacked("bob"))), digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        // OpenZeppelin最新版本使用自定义错误ERC2612ExpiredSignature
        vm.expectRevert(abi.encodeWithSignature("SignatureExpired(uint256)", deadline));
        bank.depositWithPermit2(
            bob,
            DEPOSIT_AMOUNT,
            deadline,
            signature
        );
        
        vm.stopPrank();
    }
} 