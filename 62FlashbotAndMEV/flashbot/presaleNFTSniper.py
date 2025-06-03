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
import json

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
    log_level = os.environ.get("LOG_LEVEL", "ERROR").upper()
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s - %(levelname)s - %(message)s",
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
        logger.info(f"启动Flashbots抢购脚本，网络：{network.value}")
        
        # 设置账户
        sender = get_account_from_env("ETH_SENDER_KEY")
        receiver = Account.create().address
        
        # 设置 Web3
        w3 = setup_web3(network)
        
        logger.info(f"发送钱包地址：{sender.address}")
        
        # 检查初始余额
        sender_balance = w3.eth.get_balance(sender.address)
        required_balance = Web3.to_wei(0.02, "ether")  # 1 ETH + 预留gas
        if sender_balance < required_balance:
            logger.error(f"钱包余额不足，需至少：{Web3.from_wei(required_balance, 'ether')} ETH")
            return
        else:
            logger.info(f"钱包余额充足：{Web3.from_wei(sender_balance, 'ether')} ETH")

        # 1. 加载合约
        with open("presailNFT.json", "r") as f:
            NFT_ABI = json.load(f)
        NFT_CONTRACT_ADDRESS = "0x4c1598aC47B10958aA3a6Bf5556a383486Bb9de7"
        nft_contract = w3.eth.contract(address=NFT_CONTRACT_ADDRESS, abi=NFT_ABI)

        # 2. 监听 presale 状态
        while True:
            is_active = nft_contract.functions.isPresaleActive().call()
            if is_active:
                logger.info("预售已开启，立即抢购！")
                break
            else:
                logger.info("预售未开启，等待中...")
            time.sleep(1)

        # 3. 构造 presale(100) 交易
        nonce = w3.eth.get_transaction_count(sender.address)
        presale_tx = nft_contract.functions.presale(1).build_transaction({
            "from": sender.address,
            "value": w3.to_wei(0.05, "ether"),
            "nonce": nonce,
            "gas": 300_000,
            "maxFeePerGas": w3.to_wei(3, "gwei"),
            "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
            "chainId": w3.eth.chain_id,
        })
        signed_presale_tx = w3.eth.account.sign_transaction(presale_tx, private_key=sender.key)

        bundle = [
            {"signed_transaction": signed_presale_tx.rawTransaction}
        ]
        
        # 尝试发送 bundle
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                current_block = w3.eth.block_number
                target_block = current_block + 1
                replacement_uuid = str(uuid4())
                logger.info(f"第{attempt + 1}次尝试，目标区块：{target_block}，发送抢购交易...")
                send_result = w3.flashbots.send_bundle(
                    bundle,
                    target_block_number=target_block,
                    opts={"replacementUuid": replacement_uuid},
                )
                try:
                    send_result.wait()
                    receipts = send_result.receipts()
                    logger.info(f"抢购成功！交易已打包进区块 {receipts[0].blockNumber}")
                    return
                except TransactionNotFound:
                    logger.warning(f"本轮未抢到，区块 {target_block} 未包含交易。")
            except Exception as e:
                logger.error(f"发送抢购交易时发生错误：{e}")
            if attempt < max_attempts - 1:
                time.sleep(12)
        logger.error("连续多次尝试后仍未抢到，脚本结束。")
    except KeyboardInterrupt:
        logger.info("用户主动终止脚本。")
    except Exception as e:
        logger.error(f"发生未知错误：{e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()