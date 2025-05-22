// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// 导入ECDSA库，用于处理以太坊的数字签名
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// 导入EIP712库，用于EIP712标准的签名验证
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

// 定义一个合约testVerify
contract EIP191 {
    // recover函数用于从签名中恢复出签名者的地址
    // 生活中的例子：就像从一封信的签名中识别出是谁写的信
    function recover(bytes memory message, bytes memory signature) public pure
    returns (address) {
        // 将消息转换为以太坊签名消息哈希
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);
        // 使用ECDSA库从哈希和签名中恢复出签名者的地址
        return ECDSA.recover(hash, signature);
    }   
}

// 定义一个合约EIP712Verifier，继承自EIP712
contract EIP712Verifier is EIP712 {
    using ECDSA for bytes32; // 为bytes32类型启用ECDSA库
    // 定义一个结构体Send，表示发送的交易
    struct Send {
        address to; // 接收者地址
        uint256 value; // 发送的金额
    }

    // 定义一个常量SEND_TYPEHASH，用于EIP712的类型哈希
    bytes32 public constant SEND_TYPEHASH = keccak256("Send(addressto,uint256 value)");

    // 构造函数，初始化EIP712合约
    constructor() EIP712("EIP712Verifier", "1.0.0") {}

    // hashSend函数用于计算Send结构体的哈希
    function hashSend(Send memory send) public view returns (bytes32) {
        // 使用EIP712标准计算哈希
        return _hashTypedDataV4(keccak256(abi.encode(SEND_TYPEHASH, send.to, send.value)));
    }

    // verify函数用于验证签名是否有效
    // 生活中的例子：就像检查一封信的签名是否真的来自声称的那个人
    function verify(address signer, Send memory send, bytes memory signature) public view returns (bool) {
        // 计算Send结构体的哈希
        bytes32 digest = hashSend(send);
        // 使用ECDSA库验证签名是否与签名者地址匹配
        return digest.recover(signature) == signer;
    }
}