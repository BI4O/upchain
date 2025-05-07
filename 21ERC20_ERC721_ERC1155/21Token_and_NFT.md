# 21 Token和NFT

# NFT

- 每一个token和其他的token不一样的，独一无二的
- 表达艺术品、收藏、音乐、档案、一个交易记录

## TokenURI（唯一标识）

首先必须要指定一个baseURI，因为TokenURI = baseURI + tokenId

```solidity
/// 返回指定 tokenId 的元数据 URI
function tokenURI(uint256 tokenId) external view returns (string memory);
```

- **输入**：`tokenId`（uint256）

- **输出**：一个字符串（string），通常是一个指向 JSON 文件的 URL（如 `https://…/metadata/1.json`）或 IPFS CID（如 `ipfs://Qm…`）。

#### 使用

假设你部署时设置：

- `_baseURI() → "ipfs://QmABC123/metadata/"`

那么

- `tokenURI(1)` → `"ipfs://QmABC123/metadata/1"`
- 或者若你加了后缀
  `"ipfs://QmABC123/metadata/1.json"`

这样前端或市场就能通过这个 URL/CID 去拿到对应的 JSON 元数据。

## MetaData（元数据）

这个URL得到的是一个json文件，大概长

<pre style="background-color: whitesmoke">
{
  "name": "CryptoKitty #1",
  "description": "This is my first CryptoKitty!",
  "image": "https://…/images/1.png",
  "attributes": [
    { "trait_type": "color", "value": "blue" },
    { "trait_type": "speed", "value": 10 }
  ]
}
</pre>

- **name**（必选有）：NFT 名称

- **description**：描述

- **image**（必须有）：指向可显示的图像（或动画、视频）的 URL

- **attributes**：可选，包含各种可展示的特性

这个元数据的存储最开始是某个服务器，在https下访问，但是这样不够去中心化，因为这个域名万一被卖了就数据就丢失了，所以一般现在用IPFS来代替http，按内容寻址；或者用AR(arweave)，是另一个去中心化存储服务商。

## NFT准备工作

- 图片上传到IPFS（pinata）
- 链下编写元数据JSON文件，里面的image写上上面的IPFS图片地址
- 元数据上传到IPFS得到一个hash的地址
- 调用ERC721合约的mint方法，给定owner地址、tokenId、上一步的hash地址，然后这个owner -> tokenId，再让Json文件加密地址 -> tokenId

```solidity
function mint(address to, uint256 tokenId, string memory uri) external {
    _mint(to, tokenId);
    // 直接存储每个 tokenId 的完整 URI
    _setTokenURI(tokenId, uri);
}
```

## NFT合约讲解

#### 状态变量3个

```solidity
// Token名称
string private _name;

// Token标志
string private _symbol;

// Token的资产链接（ipfs链接）
string private _baseURI;
```

#### 账本4个

全部处置权限比较难理解，在 ERC‑721 里，除了可以针对单个 `tokenId` 做授权（`approve` / `getApproved`），还可以一次性把自己名下的所有 NFT 都授权给一个「操作员（operator）」，比如说OpenSea市场帮你全部拿去展出去卖

```solidity
// 根据TokenId查主人
mapping(uint256 => address) private _owners;

// 根据地址查某人余额（跟ERC20一样）
mapping(address => uint256) private _balances;

// 根据tokenId查授权地址
mapping(uint256 => address) private _tokenApprovals;

// 拥有者 => {操作员地址 => 是否有全部处置授权}
mapping(address => mapping(address => bool)) private _operatorApprovals;
```

#### 构造函数

```solidity
constructor(
    string memory name_,
    string memory symbol_,
    string memory baseURI_
) {
    _name = name_;
    _symbol = symbol_;
    _baseURI = "https://ipfs.io/ipfs/bafybeieormpoifufwvt6run3i363qffl5s3usklbcfsghulzactks2k4wa/";
}
```

#### 拼接tokenURI

mint出来的tokenid要加上baseURI才能得到唯一的tokeURI

**存在性检查**

- 用 `_exists(tokenId)`（内部实现是检查 `_owners[tokenId] != address(0)`）确保这个 token 已经被铸造，否则报错。

**Strings 库**

- `tokenId.toString()` 来自 `using Strings for uint256;`，把数字转换为字符串。

**abi.encodePacked**

- 把多个字符串/字节拼接，然后再 `string(...)` 转成 `string memory` 返回。

```solidity
function tokenURI(uint256 tokenId) public view returns (string memory) {
    // 先检查这个 tokenId 是否已经被铸造
    require(
        _exists(tokenId),
        "ERC721Metadata: URI query for nonexistent token"
    );

    // 将 baseURI 和 tokenId 拼接成完整的 URI
    return string(abi.encodePacked(_baseURI, tokenId.toString()));
}

```

#### 铸造token并绑定归属地址、tokenURI

**铸造（mint）流程**

- 铸造就是创建一个全新的 NFT，并把它的所有权赋给 `to`。
- 按 ERC‑721 规范，铸造时要向链上声明从“地址 0”到 `to` 的转移（Transfer event）。

**余额与所有权映射**

- `_balances[to]`：记录某个地址持有多少 NFT，铸造时对它加 1。
- `_owners[tokenId]`：记录每个 NFT（通过 `tokenId`）的拥有者地址。

**事件（Event）**

- `Transfer(address(0), to, tokenId)`：表示从“空”铸造到了 `to`。前端和区块浏览器通过监听该事件来获知新的 NFT 被创建。

```solidity
function mint(address to, uint256 tokenId) public {
    // 1. 目标地址不能是零地址
    require(to != address(0), "ERC721: mint to the zero address");
    // 2. 这个 tokenId 还不能存在
    require(!_exists(tokenId), "ERC721: token already minted");

    // 3. 给接收者的余额 +1
    _balances[to] += 1;
    // 4. 记录这个 tokenId 的拥有者
    _owners[tokenId] = to;

    // 5. 触发 Transfer 事件，从 0 地址（铸造）到 to
    emit Transfer(address(0), to, tokenId);
}

```

> [!note]
>
> 问：为什么不用return一个bool表示成功，而是要emit一个事件？
>
> 答：因为事件更适合传递信息给链下系统，比如前端js，且emit是符合721规范的，并没有规范返回值，为了跟大家兼容，就都用emit来表示完成

## 授权函数

比如这个合约你想要挂到市场上去卖，那么你就必须要给市场授权，让他可以调用transderFrom，把你的NFT卖给别人

```solidity
```



## NFT标准记忆

#### 一、主权查询

- balanceOf
- ownerOf

#### 二、主权执行

- transferFrom
- saveTransferFrom
- saveTransferFrom(多一个data参数)

#### 三、授权查询

- getApproved(tokenid) -> addr
- isApprovedForAll(owner, operator) -> bool

#### 四、授权执行

- approve(operator, tokenid)
- setApprovalForAll(operator, bool)

#### 五、自定义函数

除了前面9个以外，继承了ERC721之后

##### 必须自定义的函数（2个）

- constructor(name, symbol,[baseURI])
  - 定义自己的NFT名称和符号
  - 通常要加上baseURI，如果你不固定，那么就要在mint函数中告知tokenURI
- mint(to, tokenId[, tokenURI])
  - 有内部的`_mint(to,tokenId)`用，但是可以前后加一点条件，比如收费，比如权限
  - 经过继承`ERC721URIStorage`之后，会有`_setTokenURI(tokenId, tokenURI)`用，如果没有继承，那么就要好好想想怎么给token绑定tokenURI

##### 通常要自定义的函数

- 



