// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EIP712.sol";

contract EIP191Test is Test {
    EIP191 public eip191;
    
    address public alice = makeAddr("alice");
    uint256 public alicePrivateKey = uint256(keccak256(abi.encodePacked("alice")));
    
    function setUp() public {
        eip191 = new EIP191();
        vm.startPrank(alice);
        vm.deal(alice, 100 ether);
    }
    
    function testRecover() public {
        // 准备消息
        string memory message = "Hello World";
        bytes memory messageBytes = bytes(message);
        
        // 使用私钥签名消息
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePrivateKey, MessageHashUtils.toEthSignedMessageHash(messageBytes));
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // 恢复签名者地址
        address recovered = eip191.recover(messageBytes, signature);
        
        // 验证恢复的地址与预期地址匹配
        assertEq(recovered, alice, "Recovered address should match signer");
    }
}

contract EIP712VerifierTest is Test {
    EIP712Verifier public verifier;
    
    address public alice = makeAddr("alice");
    uint256 public alicePrivateKey = uint256(keccak256(abi.encodePacked("alice")));
    
    address public recipient = makeAddr("recipient");
    uint256 public amount = 1 ether;
    
    function setUp() public {
        verifier = new EIP712Verifier();
        vm.startPrank(alice);
        vm.deal(alice, 100 ether);
    }
    
    function _createSignature(address signer, uint256 signerKey, EIP712Verifier.Send memory send) internal view returns (bytes memory) {
        // 获取域信息
        (bytes1 fields, string memory name, string memory version, uint256 chainId, address verifyingContract, , ) = verifier.eip712Domain();
        
        // 构建域分隔符
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
        
        // 构建结构化数据
        bytes32 structHash = keccak256(
            abi.encode(
                verifier.SEND_TYPEHASH(),
                send.to,
                send.value
            )
        );
        
        // 获取最终的消息摘要
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        
        // 签名
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
    
    function testVerify() public {
        // 创建Send结构体
        EIP712Verifier.Send memory send = EIP712Verifier.Send({
            to: recipient,
            value: amount
        });
        
        // 生成签名
        bytes memory signature = _createSignature(alice, alicePrivateKey, send);
        
        // 验证签名
        bool isValid = verifier.verify(alice, send, signature);
        assertTrue(isValid, "Signature should be valid");
        
        // 测试无效签名
        address bob = makeAddr("bob");
        bool isInvalid = verifier.verify(bob, send, signature);
        assertFalse(isInvalid, "Signature should be invalid for different signer");
    }
    
    function testHashSend() public {
        // 创建Send结构体
        EIP712Verifier.Send memory send = EIP712Verifier.Send({
            to: recipient,
            value: amount
        });
        
        // 计算哈希
        bytes32 hash = verifier.hashSend(send);
        
        // 确认哈希不为空
        assertTrue(hash != bytes32(0), "Hash should not be empty");
    }
}
