## 11 btc与区块链

#### 一、Web2现状

- 平台有特权
- 超级流量个体有特权，利用影响力
- 个人信息被贩卖
- 个人注册即无法控制在平台上的各种资产和动作数据主权



#### 二、Web3特点

- 代码开源透明
- 去中心化
- 存在的隐患：
  - 既然公共账本，如何保证隐私：非对称加密
  - 公共账本如何保证一致性：pow有奖励



#### 三、BTC原理

- hash算法是非对称加密，任意长短的信息都能加密成固定长度，然后保证非连续
- 每个区块由时间戳+上一个区块的hash加密值+nonce随机数组成，并再一次hash加密转给下一个区块作为“上一个区块的hash值”
- btc要求矿工节点们找到一个nonce随机数（可能有多个），使得hash值满足两个条件，1小于某个特定值2hash加密结果前面的17位为0
- 最先找到的那一个矿工（目前一般10分钟左右）把nonce广播给其他矿工，生成一个区块hash值，表示自己已经能够找到这个符合要求的nonce随机数，给大家用nonce和hash值来检查，并让大家不要算这个块了，开始算下一个
- 但是一个块并不能保证这个块里面的交易就全部记账成功，需要等待3-4个块出来才能保证倒数第三个块（约半个小时）是不会产生重组（回退）的了才行



#### 四、公钥、私钥和数字签名

- 公钥和私钥是有联系的
- 矿工要打包的交易信息都类似很多行交易信息`from A to B amount 1.5btc`，除了交易信息还有上一个区块的hash值，时间戳、还有其他信息（版本号，默克尔根，难度目标，nonce随机数）这个作为区块头（Block Head）然后其余的很多行的交易信息作为区块体/交易列表（Block Body）
- 假设我想要发起一个转账，那么我就会写一行交易信息
  - 我想打算给老王转1个btc，写了一个纸条，正文是“from 我 to 老王 amount 1”
  - 然后我把正文内容hash加密成短密文，用我的私钥+这个密文放进签名算法，得到一个数字签名比如0x123
  - 我把这个签名附在纸条上，变成“from 我 to 老王 amount 1 signature 0x123”，包含了正文和我的数字签名
  - 我把这个纸条给矿工，并把我的公钥也告诉他
  - 矿工验证我，用我的公钥把数字签名（0x123）用解密函数解密出来得到一个解文
  - 如果矿工比对后发现这个解文和我的纸条前半段的正文一模一样，那么矿工就相信我这个交易是我签名的，我准许的，交易准许



#### 四、作业

作业1：实践pow

实践 POW， 编写程序（编程语言不限）用自己的昵称 + nonce，不断修改nonce 进行 sha256 Hash 运算：

1. 直到满足 4 个 0 开头的哈希值，打印出花费的时间、Hash 的内容及Hash值。
2. 再次运算直到满足 5 个 0 开头的哈希值，打印出花费的时间、Hash 的内容及Hash值。

python中hash计算`from hashlib import sha256`然后`sha256(input_.encode('utf-8')).hexdigest()`

#### python版

```python
from hashlib import sha256
import time

# sha256加密，并检查是否符合要求
def encrypt_and_check_if_valid(s1,s2, require_zero_nums=4):
    # 一、加密
    s = str(s1) + str(s2)
    res = sha256(s.encode('utf-8')).hexdigest()

    # 二、检查是否符合  
    startZeros = '0' * require_zero_nums
    isValid = True if res.startswith(startZeros) else False

    return res,isValid

def find_and_cal_time(myName):
    startTime = time.time()
    initNonce = 0
    require_zero_nums = 4
    while require_zero_nums <= 5:        
        hashStr, isValid = encrypt_and_check_if_valid(myName, str(initNonce), require_zero_nums)
        # print('4-',initNonce,hashStr)
        # print(initNonce)
        if isValid:
            time1 = time.time() - startTime
            print('耗时%.2fs找到nonce【%s】使得【%s】hash结果%s个0开头: %s' % 
                (time1,initNonce,myName+str(initNonce),require_zero_nums,hashStr))
            require_zero_nums += 1
        initNonce += 1


if __name__ == '__main__':
    find_and_cal_time('bi4o')
```

得到结果

```cmd
耗时0.01s找到nonce【12182】使得【bi4o12182】hash结果4个0开头: 000042f053f9702a2e850020eefb15908802d6c0507cd4f97f712c4800f65cc6
耗时3.31s找到nonce【2864137】使得【bi4o2864137】hash结果5个0开头: 00000fd3eb820677dbeb63f6c25a7aa4642f8992da564add18afcb67c54431bf
```

#### javascript版

```js
const { createHash } = require('crypto');

// 加密且检查是否符合要求
const encrypt = (s1,s2,require_zero_num=4) => {
    const res = createHash('sha256').update(s1+s2).digest('hex');
    const isValid = res.startsWith(Array(require_zero_num + 1).join(0)); 
    // console.log(res);
    return { res, isValid };
}

// 循环查看
const find_and_cal_time = (name) => {
    let require_zero_num = 4;
    let nonce = 0;
    const startTime = performance.now();
    let markTime;
    while (require_zero_num <= 5) {
        const {res, isValid} = encrypt(name,nonce.toString(),require_zero_num);
        if (isValid) {
            markTime = (performance.now() - startTime).toFixed(2)
            console.log(`耗时${markTime}ms找到了nonce${nonce.toString()}加密[${name + nonce.toString()}]开头${require_zero_num}个0的hash值${res}`);
            require_zero_num += 1;
        }
        nonce += 1;
    }
}


find_and_cal_time('bi4o');
```

结果

```cmd
耗时16.32ms找到了nonce12182加密[bi4o12182]开头4个0的hash值000042f053f9702a2e850020eefb15908802d6c0507cd4f97f712c4800f65cc6
耗时3074.42ms找到了nonce2864137加密[bi4o2864137]开头5个0的hash值00000fd3eb820677dbeb63f6c25a7aa4642f8992da564add18afcb67c54431bf
```



作业2：模拟私钥数字签名和公钥验证签名

```python
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

```

得到结果

```cmd
一、找到nonce：12182使得hash(bi4o12182)=000042f053f9702a2e850020eefb15908802d6c0507cd4f97f712c4800f65cc6

二、签名（hex）： b'_K\xea[\x96\xe2\xe3lD\xa7\xa8\x83\xa8g>pY\x10]\xb8\xff\x91F\x9c\x11\xf8\x98]\x1fP\xb9p\xc3\xf3\xb1\x1e\xe2(g\xfa\xe6\xf4v\x07\xddV6I\x154\xd6n\xd8\xab\xd3\xab`\xe9\xcf\x88\xe96*H\x81\xeei\x05V;LP\x91\xd8#V94[\x19]\xf24\xa8\xfdk\x9f1]\x08\xfey\x997\xdd2\xafu:\x895\xf4\x91\xd0\x9b=\xf4\xe9\x8a\x05\x8b\xe7\xa3*\x9c4\xc2\xbd\xcbnB\x1a\xd4\xdb\x87RJ#\xe1\x08\x00\xfez\x84\xdc\x93\x03\x03}1\x8b\x06\xda8\xac\x021\x98\x80\xd2\xa23\x14\xbb#\xe2O\x8bAy\xf1\x0f2k\x86\x1f\xdc\xc7\x90\xb5g\xb9A\x1a\xeb\x18\xba\xdf\xd3\xb2\xf8@Pkd7\xfe\x14\xd2*9\x8bD\x08\xe6\xee\x04$\xb5[\xa4\xae\xb8\x9f\xa1z\xf2\xc6\x8b>PrUA*\x08h\x0e\x05M\x08x\xa7\x1e\xb7_\'\xe2\x9ck/\x97f\xb9:\xc10 \xfe\xe0{h;\x92\x14r\x93\xe9["\xc6\xb4\x88\x025\x1b'

三、验证通过
```

