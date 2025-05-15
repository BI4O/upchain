// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// 导入Forge的测试库，提供测试框架功能
import "forge-std/Test.sol";
// 导入Forge的控制台库，用于调试输出
import {console} from "forge-std/console.sol";
// 导入我们要测试的合约
import "../src/testVerify.sol";

/**
 * @title 测试签名验证合约
 * @notice 这个合约演示了两种不同的签名验证方式:
 * 1. 简单的消息签名验证 (ECDSA) - 类似于对一封普通信件的签名
 * 2. EIP-712结构化签名验证 - 类似于对一份带有固定格式的合同进行签名
 */
contract TestVerify is Test {
    // 需要测试的合约实例
    testVerify private verifyContract;
    EIP712Verifier private eip712Verifier;
    
    // 用于测试的私钥和地址
    uint256 private signerPrivateKey;
    address private signerAddress;
    
    // 另一个用户的私钥和地址（用于测试错误签名）
    uint256 private otherPrivateKey;
    address private otherAddress;

    /**
     * @notice 设置测试环境
     * @dev 这个函数在每个测试用例执行前都会运行
     */
    function setUp() public {
        // 初始化合约实例
        verifyContract = new testVerify();
        eip712Verifier = new EIP712Verifier();
        
        // 设置一个测试用的私钥和对应的地址
        // 在实际应用中，私钥应该是保密的，只有持有者知道
        signerPrivateKey = 0xA11CE;  // 这是一个示例私钥，仅用于测试
        signerAddress = vm.addr(signerPrivateKey);  // 使用Forge的vm工具从私钥生成地址
        
        // 设置另一个用户的私钥和地址，用于测试错误签名
        otherPrivateKey = 0xB0B;  // 另一个示例私钥
        otherAddress = vm.addr(otherPrivateKey);
    }

    /**
     * @notice 测试简单消息签名和恢复过程
     * @dev 这个测试演示了如何对一个简单的消息进行签名，并验证签名
     * 
     * 生活例子：就像在传统信件上签名
     * 1. 撰写信件内容（消息）
     * 2. 在信件末尾签上你的名字（签名）
     * 3. 收件人通过比对你的签名笔迹来验证信件确实来自你（验证）
     */
    function testSimpleRecover() public {
        // 步骤1: 定义要签名的消息
        string memory messageStr = "hello world";
        bytes memory message = bytes(messageStr);
        
        // 步骤2: 对消息进行签名
        // 2.1 首先将消息转换为以太坊认可的消息格式
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(message);
        console.logBytes32(messageHash);
        // 2.2 使用私钥对消息哈希进行签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, messageHash);
        // 2.3 将签名组件打包成一个完整的签名
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // 步骤3: 恢复签名者地址并验证
        address recoveredAddress = verifyContract.recover(message, signature);
        console.logAddress(recoveredAddress);
        console.logAddress(signerAddress);

        // 步骤4: 验证恢复的地址与签名者地址匹配
        assertEq(recoveredAddress, signerAddress, "Signature verification failed: recovered address doesn't match signer");
    }

    /**
     * @notice 测试EIP-712结构化数据签名和验证
     * @dev 这个测试演示了如何对结构化数据进行签名，并验证签名
     * 
     * 生活例子：就像签署一份正式合同
     * 1. 填写标准合同表格（结构化数据）
     * 2. 在合同上签名（结构化签名）
     * 3. 对方验证你的签名是否真实有效（验证）
     * 
     * EIP-712的优势：用户可以清晰地看到自己在签署什么内容，而不是一堆难以理解的哈希值
     */
    function testEIP712Verification() public {
        // 步骤1: 创建结构化数据
        EIP712Verifier.Send memory send = EIP712Verifier.Send({
            to: address(0x456),
            value: 1000
        });

        // 步骤2: 获取要签名的结构化数据哈希
        // EIP-712会生成一个域分隔符和类型哈希，确保签名的数据有明确的含义和上下文
        bytes32 digest = eip712Verifier.hashSend(send);
        
        // 步骤3: 使用私钥对结构化数据哈希进行签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 步骤4: 验证签名
        bool isValid = eip712Verifier.verify(signerAddress, send, signature);

        // 步骤5: 断言签名验证结果
        assertTrue(isValid, "EIP712 signature verification failed");
    }
    
    /**
     * @notice 测试签名验证的安全性 - 使用错误的签名者
     * @dev 这个测试演示了当使用错误的签名者时，验证应该失败
     * 
     * 生活例子：就像有人试图伪造你的签名
     * 1. 有人试图以你的名义签署文件
     * 2. 银行应该能够识别出这不是你的签名，并拒绝交易
     */
    function testVerificationFailure() public {
        // 步骤1: 创建结构化数据
        EIP712Verifier.Send memory send = EIP712Verifier.Send({
            to: address(0x456),
            value: 1000
        });

        // 步骤2: 获取要签名的结构化数据哈希
        bytes32 digest = eip712Verifier.hashSend(send);
        
        // 步骤3: 使用私钥对结构化数据哈希进行签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 步骤4: 尝试用错误的签名者地址进行验证
        // 这里我们用otherAddress而不是signerAddress
        bool isValid = eip712Verifier.verify(otherAddress, send, signature);

        // 步骤5: 断言签名验证应该失败（isValid应该为false）
        assertFalse(isValid, "Verification should fail with incorrect signer");
    }
    
    /**
     * @notice 测试签名验证的安全性 - 篡改签名数据
     * @dev 这个测试演示了当签名数据被篡改时，验证应该失败
     * 
     * 生活例子：就像有人修改了已签名合同上的条款
     * 1. 签署了一份合同后，对方修改了合同中的金额
     * 2. 验证系统应该能够检测到这种篡改并拒绝交易
     */
    function testDataTamperingFailure() public {
        // 步骤1: 创建原始结构化数据
        EIP712Verifier.Send memory originalSend = EIP712Verifier.Send({
            to: address(0x456),
            value: 1000
        });

        // 步骤2: 获取要签名的结构化数据哈希
        bytes32 digest = eip712Verifier.hashSend(originalSend);
        
        // 步骤3: 使用私钥对结构化数据哈希进行签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 步骤4: 创建被篡改的数据（更改了value）
        EIP712Verifier.Send memory tamperedSend = EIP712Verifier.Send({
            to: address(0x456),
            value: 2000 // 修改了value，从1000变为2000
        });

        // 步骤5: 尝试使用原始签名验证被篡改的数据
        bool isValid = eip712Verifier.verify(signerAddress, tamperedSend, signature);

        // 步骤6: 断言签名验证应该失败（isValid应该为false）
        assertFalse(isValid, "Verification should fail with tampered data");
    }
} 