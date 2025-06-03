from eth_account.signers.local import LocalAccount
from web3 import Web3, HTTPProvider
from flashbots import flashbot
from eth_account.account import Account
import os

ETH_ACCOUNT_SIGNATURE: LocalAccount = Account.from_key(os.environ.get("ETH_SIGNER_KEY"))


w3 = Web3(HTTPProvider("http://localhost:8545"))
flashbot(w3, ETH_ACCOUNT_SIGNATURE)