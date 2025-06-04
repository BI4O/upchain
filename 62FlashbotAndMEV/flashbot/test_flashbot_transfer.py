"""
简化版 Flashbots 测试脚本 - 只发送一个简单的 ETH 转账交易
用于调试 internal server error 问题

使用方法：
export ETH_SENDER_KEY="你的私钥"
export ETH_SIGNER_KEY="你的签名私钥" 
python simple_flashbots_test.py
"""

import os
import time
import logging
from uuid import uuid4

from eth_account import Account
from web3 import Web3, HTTPProvider
from web3.exceptions import TransactionNotFound

from flashbots import flashbot

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

def main():
    # Sepolia 配置
    provider_url = "https://sepolia.infura.io/v3/33115389a88b4072bd35df8d6cf7890e"
    relay_url = "https://relay-sepolia.flashbots.net"
    chain_id = 11155111
    
    # 创建 Web3 实例
    w3 = Web3(HTTPProvider(provider_url))
    
    if not w3.is_connected():
        logger.error("无法连接到以太坊节点")
        return
    
    # 获取账户
    sender = Account.from_key(os.environ["ETH_SENDER_KEY"])
    signer = Account.from_key(os.environ["ETH_SIGNER_KEY"])
    
    # 设置 Flashbots
    flashbot(w3, signer, relay_url)
    
    logger.info(f"发送者: {sender.address}")
    logger.info(f"当前区块: {w3.eth.block_number}")
    
    # 检查余额
    balance = w3.eth.get_balance(sender.address)
    logger.info(f"余额: {Web3.from_wei(balance, 'ether')} ETH")
    
    if balance < Web3.to_wei(0.01, "ether"):
        logger.error("余额不足")
        return
    
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            # 获取当前状态
            current_block = w3.eth.block_number
            target_block = current_block + 1
            nonce = w3.eth.get_transaction_count(sender.address)
            
            logger.info(f"第 {attempt + 1} 次尝试，目标区块: {target_block}, nonce: {nonce}")
            
            # 创建一个简单的 ETH 转账交易
            receiver = Account.create().address  # 随机接收地址
            
            # 获取 gas 价格
            latest_block = w3.eth.get_block("latest")
            base_fee = latest_block.get("baseFeePerGas", 0)
            max_priority_fee = Web3.to_wei(2, "gwei")
            max_fee = base_fee + max_priority_fee + Web3.to_wei(1, "gwei")
            
            tx = {
                "to": Web3.to_checksum_address(receiver),
                "value": Web3.to_wei(0.001, "ether"),  # 发送 0.001 ETH
                "gas": 21000,
                "maxFeePerGas": max_fee,
                "maxPriorityFeePerGas": max_priority_fee,
                "nonce": nonce,
                "chainId": chain_id,
                "type": 2,
            }
            
            # 签名交易
            signed_tx = w3.eth.account.sign_transaction(tx, private_key=sender.key)
            
            # 创建 bundle
            bundle = [{"signed_transaction": signed_tx.rawTransaction}]
            
            logger.info("开始模拟...")
            
            # 先模拟
            try:
                simulation = w3.flashbots.simulate(bundle, target_block)
                if "error" in simulation:
                    logger.error(f"模拟错误: {simulation['error']}")
                    continue
                else:
                    logger.info("模拟成功")
                    logger.debug(f"模拟结果: {simulation}")
            except Exception as e:
                logger.error(f"模拟失败: {e}")
                continue
            
            # 发送 bundle
            logger.info("发送 bundle...")
            try:
                send_result = w3.flashbots.send_bundle(
                    bundle,
                    target_block_number=target_block,
                    opts={"replacementUuid": str(uuid4())},
                )
                
                logger.info("Bundle 已发送，等待结果...")
                
                # 等待结果
                send_result.wait()
                receipts = send_result.receipts()
                
                if receipts:
                    logger.info(f"✅ 成功！交易 hash: {receipts[0].transactionHash.hex()}")
                    logger.info(f"区块: {receipts[0].blockNumber}")
                    return
                else:
                    logger.warning("Bundle 未被包含")
                    
            except TransactionNotFound:
                logger.warning(f"区块 {target_block} 未包含 bundle")
            except Exception as e:
                logger.error(f"发送 bundle 错误: {e}")
                
                # 特别处理 internal server error
                if "internal server error" in str(e).lower():
                    logger.warning("⚠️  可能的原因:")
                    logger.warning("1. Nonce 冲突 - 交易已被使用")
                    logger.warning("2. Gas 价格设置问题")
                    logger.warning("3. Flashbots 服务器暂时不可用")
                    logger.warning("4. 交易格式不正确")
            
            if attempt < max_attempts - 1:
                logger.info("等待下一个区块...")
                time.sleep(13)
        
        except Exception as e:
            logger.error(f"循环中出错: {e}")
            time.sleep(13)
    
    logger.error("所有尝试都失败了")

if __name__ == "__main__":
    main()