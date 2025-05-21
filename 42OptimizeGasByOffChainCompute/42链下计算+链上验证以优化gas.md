# 42链下计算+链上验证

节省gas的技巧总结来说有

1. 区分交易gas和部署gas

2. 改变状态变量的命名顺序，进行槽合并

3. constant或者immutable代替变量，后者只能初始化时候赋值一次

4. 声明函数的可见性如private和internal

5. 尽量避免任何for循环，用线下计算

6. 对于过程数据用event来存进logs空间，而不是变量

7. 减少链上数据：IPFS线上存储

8. EIP1167，最小代理合约来部署大量重复的合约

9. ##### 链下计算，链上认证（本节重点）

## 链下排序+链上验证

#### 基本需求

合约记录每个学生信息，每人有address和score两个属性，增删尽量高效，获取学生全名单尽量高效

1. 如果只用Student[]，虽然获取全名单方便，但是增删非常昂贵，需要动1～n个slot，随着规模变大，增删消耗没有上限
2. 如果用只用mapping(address => Student)，虽然增删都是动1个slot很高效，但是获取全名单是没有办法的

#### 优化思路

- 考虑用链表结构，存储学生的address、score、nextAddress
- 用address作为index来表示学生
  - mapping(address=>Student{uint score, address next})
- 考虑连struct也不要了，用两个mapping
  - mapping(address => uint)
  - mapping(address => address)
- 至于size，因为线下会用来遍历，可以保存一个uint Size

#### 好处

- 增删非常高效，增删改都是动3/4/1个slot(1/2/0个next+1/1/0个address+1个score)，规模增加都是不变

#### 进一步

这个有序链表的**有序**特性还可以利用一下，假如是按分数排序，那么在新增和删除和更新多加一点判断逻辑即可，而且这个该在哪里插入的这个循环判断，还可以放到链下用js计算，然后上传需要插入/删除/更新的位置信息即可，如果是更新/新增还需要增加分数信息

代码如下

```solidity
contract linkArray {
    uint public listSize;

    // 链表头
    address constant FIRST = address(1);
    // 属性1指针
    mapping(address => address) _nextSdt;
    // 属性2score
    mapping(address => uint) public score;

    constructor() {
        // 循环列表
        _nextSdt[FIRST] = FIRST;
        listSize = 0;
    }

    // 验证
    function _verifyIndex(address prev, uint newValue, address next) internal view returns(bool) {
        // 鉴定 A -> New -> B是否真的是 A.value > new.value > B.value
        // 如果A或者B是FIRST都可以免于那一侧检查，因为FIRST是边界，没有value
        bool leftOk = prev == FIRST || score[prev] >= newValue;
        bool rightOk = next == FIRST || newValue >= score[next];
        return leftOk && rightOk;
    }

    function addSdt(
        address newSdt,
        address toWhom,
        uint newScore
    ) public {
        // 把newSdt安插到toWhom的后面
        // 本来 toWhom -> toWhom.next
        // 变成 toWhom -> newSdt -> toWhom.next
        require(_nextSdt[newSdt] == address(0),"newSdt already exist!");
        require(_nextSdt[toWhom] != address(0),"nextSdt not exist!");
        require(_verifyIndex(toWhom, newScore, _nextSdt[toWhom]), "value not ordered!");
        // 插入新元素
        _nextSdt[newSdt] = _nextSdt[toWhom];
        _nextSdt[toWhom] = newSdt;
        score[newSdt] = newScore;
        // 人数增加
        listSize += 1;
    }

    function removeSdt(address sdtToRemove, address prevSdt) public {
        // 
        require(_nextSdt[sdtToRemove] != address(0), "no student to remove!");
        require(_nextSdt[prevSdt] == sdtToRemove, "wrong student to update _next");
        // 修改指针
        _nextSdt[prevSdt] = _nextSdt[sdtToRemove];
        // 删除属性next和score
        _nextSdt[sdtToRemove] = address(0);
        score[sdtToRemove] = 0;
        // 人数减少
        listSize -= 1;
    }

    function undateScore(address updateSdt, uint newValue, address removeFromWhom, address addToWhom) public {
        // 原来的 removeFromWhom -> updateSdt 变成 removeFromWhom -> updateSdt.next
        require(
            _nextSdt[updateSdt] != address(0) &&
            _nextSdt[removeFromWhom] != address(0) &&
            _nextSdt[addToWhom] != address(0),
            "invalid student!"
        );
        // 如果removeFrom和addToWhom是同一个人，那么就不用改链
        // 链上验证是不是真的符合要求
        if (removeFromWhom == addToWhom) {
            require(_nextSdt[removeFromWhom] == updateSdt);
            require(_verifyIndex(removeFromWhom, newValue, _nextSdt[updateSdt]));
            score[updateSdt] = newValue;
        } else {
            removeSdt(updateSdt, removeFromWhom);
            addSdt(updateSdt, addToWhom, newValue);
        }
    }

    function getTop(uint k) public view returns(address[] memory) {
        // 因为本来指针安排好就是有序的，从FIRST开始数k个就是
        require(k <= listSize, "student not enough!");
        address[] memory sdtList = new address[](k);
        address currAddr = _nextSdt[FIRST];
        for (uint i=0; i < k; i++) {
            sdtList[i] = currAddr;
            currAddr = _nextSdt[currAddr];
        }
        return sdtList;     
    }
}
```

## 链下存储+链上验证（默克尔树）

#### 基本需求

一个NFT的白名单用户，如果是白名单就可以100token买，如果不是就需要200token买，非白名单当然不用存链上这个我们不关心，可是白名单如果用一个mapping(address => bool)，数量如果达到了几百万的话，那就相当于这个合约占用了几百万个slot，虽然读写高效，但是**一次过批量上传**的时候都是需要大量gas的，相当于浪费了很多

#### 优化思路

对于那些已经固定死了的情况，这个批量上传address其实可以转化为上传一个merkle树根（一个hash），这个merkle树是线下用已知的address或者附加信息的hash构建的

#### 一、线下建树

```ts
import { toHex, encodePacked, keccak256 } from 'viem';
import { MerkleTree } from "merkletreejs";

// 叶子原信息只要是合约里的类型都可以，外层是一个数组
const users = [
  { address: "0xD08c8e6d78a1f64B1796d6DC3137B19665cb6F1F", amount: BigInt(10) },
  { address: "0xb7D15753D3F76e7C892B63db6b4729f700C01298", amount: BigInt(15) },
  { address: "0xf69Ca530Cd4849e3d1329FBEC06787a96a3f9A68", amount: BigInt(20) },
  { address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824800", amount: BigInt(30) },
];

// 一、数据翻译+加密处理 => users[hash1,hash2...]
// 跟合约MerkleDistributor.sol 的加密一样 #keccak256(abi.encodePacked(account, amount));
// 注意合约里面用abi.encode的话这里也要用abi.encode
// element在合约里面是byte32数据
const elements = users.map((x) =>
    keccak256(encodePacked(["address", "uint256"], [x.address as `0x${string}` , x.amount]))
  );

// 二、建树
const merkleTree = new MerkleTree(elements, keccak256, { sort: true });
const root = merkleTree.getHexRoot();

// 三、拿树根去给MerkleDistributor.sol初始化
console.log("root:" + root);


// 后续线下验证就是提供：叶子原信息leaf + 存在证据proof，
// 给到viem去调用merkle树合约就得到bool值
const leaf = elements[3];
const proof = merkleTree.getHexProof(leaf);
console.log("proof:" +proof);
```

#### 二、线上验证

这个树合约需要在拿到这个bytes32的root部署，然后之后才可以让线下去用

```solidity
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
  Ref: https://github.com/Uniswap/merkle-distributor
 */
contract MerkleDistributor {
    bytes32 public immutable merkleRoot;
    event Claimed(address account, uint256 amount);
    
    constructor(bytes32 merkleRoot_) {
        merkleRoot = merkleRoot_;
    }

    function claim(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) public {
        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(account, amount));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, node),
            "MerkleDistributor: Invalid proof."
        );
        // 比如说验证通过了，白名单就可以发起token.permit + token.transferFrom了
        // 其他的逻辑都可以加在这里

        emit Claimed(account, amount);
    }
}
```

然后线下就可以用这个默克尔树的claim来启动逻辑，这个函数名不一定叫claim，可以返回一个bool值，一切看你需要什么逻辑，比如

```solidity
function isWhitelisted(address account, uint256 amount, bytes32[] calldata merkleProof) external view returns (bool) {
    bytes32 node = keccak256(abi.encodePacked(account, amount));
    return MerkleProof.verify(merkleProof, merkleRoot, node);
```



## multicall

### 一、合约的multicall

