from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
import hashlib

# 1. 生成 RSA 公私钥对
key = RSA.generate(2048)
PRI = key
PUB = key.publickey()

# 2. 定义必要的函数
MSG = 'bi4o'

# 2. pow 符合要求的拼接好昵称+随机数的信息
def find_valid_hash(msg, initNonce=0):
    nonce = initNonce
    while 1:
        concat_msg = msg + str(nonce)
        hashMsg = hashlib.sha256(concat_msg.encode('utf-8')).hexdigest()
        if hashMsg.startswith('0000'):
            print('一、找到nonce：%s使得hash(%s%s)=%s' % (nonce,msg,nonce,hashMsg))
            return concat_msg
        nonce += 1

def signature(msg, privateKey):
    # sha256加密
    hashMsg = SHA256.new(msg.encode())
    # print(hashMsg.hexdigest())
    signature = pkcs1_15.new(privateKey).sign(hashMsg)
    print('\n二、签名（hex）：',signature)
    return signature

def verify(signature, msg, publickey):
    hashMsg = SHA256.new(msg.encode())
    # 公钥解密
    try:
        pkcs1_15.new(publickey).verify(hashMsg, signature)
        print('\n三、验证通过')
    except:
        print('\n三、验证失败')

if __name__ == '__main__':
    # 1. pow 找到符合要求的msg
    concat_msg = find_valid_hash(MSG)

    # 2. 用私钥对信息签名
    sign = signature(concat_msg, PRI)

    # 3. 用公钥对签名解密，并与原信息比对
    verify(sign, concat_msg, PUB)
