"""
修复版本的 Flashbots 示例代码
发送包含两个交易的 bundle，将一些 ETH 转账到随机账户

环境变量：
- ETH_SENDER_KEY: 发送 ETH 的账户私钥
- ETH_SIGNER_KEY: 用于签名 bundle 的账户私钥（仅用于 Flashbots 声誉，应该为空账户）
- PROVIDER_URL: (可选) HTTP JSON-RPC 以太坊提供商 URL
- LOG_LEVEL: (可选) 设置日志级别，默认为 'INFO'

使用方法：
python flashbots_example_fixed.py <network> [--log-level LEVEL]

示例：
LOG_LEVEL=DEBUG python flashbots_example_fixed.py sepolia --log-level DEBUG
"""

import argparse
import logging
import os
import secrets
import time
from enum import Enum
from uuid import uuid4

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3, HTTPProvider
from web3.exceptions import TransactionNotFound
from web3.types import TxParams

from flashbots import flashbot

# 网络配置
class Network(Enum):
    MAINNET = "mainnet"
    GOERLI = "goerli"
    SEPOLIA = "sepolia"

FLASHBOTS_NETWORKS = {
    Network.MAINNET: {
        "provider_url": "https://eth-mainnet.g.alchemy.com/v2/your-alchemy-key",
        "relay_url": "https://relay.flashbots.net",
        "chain_id": 1,
    },
    Network.GOERLI: {
        "provider_url": "https://eth-goerli.g.alchemy.com/v2/your-alchemy-key", 
        "relay_url": "https://relay-goerli.flashbots.net",
        "chain_id": 5,
    },
    Network.SEPOLIA: {
        "provider_url": "https://eth-sepolia.g.alchemy.com/v2/your-alchemy-key",
        "relay_url": "https://relay-sepolia.flashbots.net", 
        "chain_id": 11155111,
    },
}

# 配置日志
def setup_logging():
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    return logging.getLogger(__name__)

logger = setup_logging()

class EnumAction(argparse.Action):
    def __init__(self, **kwargs):
        enum_type = kwargs.pop("type", None)
        if enum_type is None:
            raise ValueError("type must be assigned an Enum when using EnumAction")
        if not issubclass(enum_type, Enum):
            raise TypeError("type must be an Enum when using EnumAction")
        kwargs.setdefault("choices", tuple(e.value for e in enum_type))
        super().__init__(**kwargs)
        self._enum = enum_type

    def __call__(self, parser, namespace, values, option_string=None):
        value = self._enum(values)
        setattr(namespace, self.dest, value)

def parse_arguments():
    parser = argparse.ArgumentParser(description="Flashbots simple example")
    parser.add_argument(
        "network",
        type=Network,
        action=EnumAction,
        help=f"The network to use ({', '.join(e.value for e in Network)})",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="INFO",
        help="Set the logging level",
    )
    args = parser.parse_args()
    return args.network

def env(key: str) -> str:
    value = os.environ.get(key)
    if value is None:
        raise ValueError(f"Environment variable '{key}' is not set")
    return value

def random_account() -> LocalAccount:
    key = "0x" + secrets.token_hex(32)
    return Account.from_key(key)

def get_account_from_env(key: str) -> LocalAccount:
    return Account.from_key(env(key))

def setup_web3(network: Network):
    """设置 Web3 实例和 Flashbots"""
    provider_url = os.environ.get(
        "PROVIDER_URL", FLASHBOTS_NETWORKS[network]["provider_url"]
    )
    logger.info(f"Using RPC: {provider_url}")
    
    # 创建 Web3 实例
    w3 = Web3(HTTPProvider(provider_url))
    
    # 检查连接
    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to {provider_url}")
    
    # 获取签名账户
    signer = get_account_from_env("ETH_SIGNER_KEY")
    relay_url = FLASHBOTS_NETWORKS[network]["relay_url"]
    
    # 设置 Flashbots
    flashbot(w3, signer, relay_url)
    
    logger.info(f"Connected to {network.value} network")
    logger.info(f"Chain ID: {w3.eth.chain_id}")
    logger.info(f"Latest block: {w3.eth.block_number}")
    
    return w3

def log_account_balances(w3: Web3, sender: str, receiver: str):
    """记录账户余额"""
    sender_balance = w3.eth.get_balance(Web3.to_checksum_address(sender))
    receiver_balance = w3.eth.get_balance(Web3.to_checksum_address(receiver))
    
    logger.info(f"Sender balance: {Web3.from_wei(sender_balance, 'ether'):.6f} ETH")
    logger.info(f"Receiver balance: {Web3.from_wei(receiver_balance, 'ether'):.6f} ETH")

def create_transaction(w3: Web3, sender: str, receiver: str, nonce: int, network: Network) -> TxParams:
    """创建交易"""
    try:
        # 获取最新区块信息
        latest_block = w3.eth.get_block("latest")
        base_fee = latest_block.get("baseFeePerGas", 0)
        
        # 设置 gas 费用
        max_priority_fee = Web3.to_wei(2, "gwei")  # 2 Gwei tip
        max_fee = base_fee + max_priority_fee + Web3.to_wei(1, "gwei")  # 额外缓冲
        
        # 估算 gas
        gas_estimate = 21000  # 标准转账
        
        tx = {
            "from": Web3.to_checksum_address(sender),
            "to": Web3.to_checksum_address(receiver),
            "gas": gas_estimate,
            "value": Web3.to_wei(0.001, "ether"),
            "nonce": nonce,
            "maxFeePerGas": max_fee,
            "maxPriorityFeePerGas": max_priority_fee,
            "chainId": FLASHBOTS_NETWORKS[network]["chain_id"],
        }
        
        logger.debug(f"Created transaction: {tx}")
        return tx
        
    except Exception as e:
        logger.error(f"Error creating transaction: {e}")
        raise

def main():
    try:
        network = parse_arguments()
        logger.info(f"Starting Flashbots example on {network.value}")
        
        # 设置账户
        sender = get_account_from_env("ETH_SENDER_KEY")
        receiver = Account.create().address
        
        # 设置 Web3
        w3 = setup_web3(network)
        
        logger.info(f"Sender address: {sender.address}")
        logger.info(f"Receiver address: {receiver}")
        
        # 检查初始余额
        log_account_balances(w3, sender.address, receiver)
        
        # 检查发送者余额是否足够
        sender_balance = w3.eth.get_balance(sender.address)
        required_balance = Web3.to_wei(0.002, "ether")  # 0.002 ETH for transactions + gas
        
        if sender_balance < required_balance:
            logger.error(f"Insufficient balance. Required: {Web3.from_wei(required_balance, 'ether')} ETH")
            return
        
        # 在这里添加一个早期返回，避免实际发送交易（用于测试）
        logger.info("Setup completed successfully. Uncomment the following code to send actual transactions.")
        # return

        # 获取 nonce
        nonce = w3.eth.get_transaction_count(sender.address)
        
        # 创建两个交易
        tx1 = create_transaction(w3, sender.address, receiver, nonce, network)
        tx2 = create_transaction(w3, sender.address, receiver, nonce + 1, network)
        
        # 签名第一个交易
        tx1_signed = w3.eth.account.sign_transaction(tx1, private_key=sender.key)
        
        # 创建 bundle
        bundle = [
            {"signed_transaction": tx1_signed.raw_transaction},
            {"transaction": tx2, "signer": sender},
        ]
        
        # 尝试发送 bundle
        max_attempts = 10
        for attempt in range(max_attempts):
            try:
                current_block = w3.eth.block_number
                target_block = current_block + 1
                
                logger.info(f"Attempt {attempt + 1}/{max_attempts} - Targeting block {target_block}")
                
                # 仅在主网上模拟
                if network == Network.MAINNET:
                    try:
                        logger.info("Simulating bundle...")
                        w3.flashbots.simulate(bundle, current_block)
                        logger.info("Bundle simulation successful")
                    except Exception as e:
                        logger.warning(f"Simulation failed: {e}")
                        continue
                
                # 发送 bundle
                replacement_uuid = str(uuid4())
                logger.info(f"Sending bundle with UUID: {replacement_uuid}")
                
                send_result = w3.flashbots.send_bundle(
                    bundle,
                    target_block_number=target_block,
                    opts={"replacementUuid": replacement_uuid},
                )
                
                bundle_hash = send_result.bundle_hash()
                logger.info(f"Bundle hash: {w3.to_hex(bundle_hash)}")
                
                # 等待结果
                logger.info("Waiting for bundle to be mined...")
                send_result.wait()
                
                try:
                    receipts = send_result.receipts()
                    logger.info(f"Success! Bundle mined in block {receipts[0].blockNumber}")
                    
                    # 显示最终余额
                    log_account_balances(w3, sender.address, receiver)
                    return
                    
                except TransactionNotFound:
                    logger.info(f"Bundle not found in block {target_block}")
                    
                    # 取消之前的 bundle
                    try:
                        cancel_result = w3.flashbots.cancel_bundles(replacement_uuid)
                        logger.info(f"Cancelled bundle: {cancel_result}")
                    except Exception as e:
                        logger.warning(f"Failed to cancel bundle: {e}")
                
            except Exception as e:
                logger.error(f"Error in attempt {attempt + 1}: {e}")
                
            # 等待下一个区块
            if attempt < max_attempts - 1:
                logger.info("Waiting for next block...")
                time.sleep(12)  # 以太坊大约12秒一个区块
        
        logger.error("Failed to send bundle after maximum attempts")
        
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()