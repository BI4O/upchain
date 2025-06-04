from eth_account import Account

def generate_eth_keypair():
    # 生成一个随机账户（包含私钥）
    acct = Account.create()

    # 获取私钥（以 hex 字符串形式展示）
    private_key = acct.key.hex()
    
    # 获取地址（以太坊公钥的 Keccak-256 哈希的最后 20 字节）
    address = acct.address

    return private_key, address

# 示例：调用函数生成一组 key pair
priv, addr = generate_eth_keypair()
print("Private Key:", priv)
print("Address:", addr)