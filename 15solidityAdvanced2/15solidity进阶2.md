# 15 Solidity 进阶 2

## 交易底层-ABI 编码

调用一个合约的函数 = 想合约发送了一个交易

而函数调用的信息就是 msg.data，也是 abi 编码数据（16 进制）

##### 一、把 ABI 描述变成 ABI 编码

<h5 align="center">myFunction(parameters)  ──► 0xabcdef0123456789…  
</h5>

##### 二、把 ABI 编码放入交易对象的 data 中

<pre style="background-color: whitesmoke; padding: 30px">{
  "to": "0x0123456…",   // 合约地址
  "value": 0,           // 不发送以太
  "data": "0xabcdef0123456789…"  // 调用数据
}</pre>

从交易信息就可以看出来，这个“交易”不涉及转账，只是在调用函数

##### 三、整个交易对象用私钥签名（授权）

签名过程中会先对交易内容加密 hash，然后再用私钥签名，生成加密签名串

##### 四、发送到 ETH 网络执行

多个矿工节点用公钥确认无误，并且有足够的手续费，就把这个交易打包进区块，最终改变链上状态

> [!note]
>
> 在步骤一，“把 ABI 描述变为 ABI 编码”中，ABI 编码有好几种方式，但最终都是为了告诉 EVM：我要用哪个“函数”，以及给什么“函数参数”，格式是
>
> `[4 字节函数选择子（selector)][完整 ABI 编码的参数区]`
>
> ##### 函数的表示（selector）
>
> 函数的 encode 其实是把函数运行当成**字符串签名 Signature**比如`f(uint256)`（注意这里 uint256 不能简写为 uint），通过 keccak256 加密，然后取前 4 个字节的 byte4 类型数据来表示比如
>
> `bytes4 selector = bytes4(keccak256("f(uint256)"))`
>
> 这个得到的 bytes4 也叫**“selector”**，相当于长度为 4 的 bytes 数组；
>
> ##### 函数的参数表示（ABI 编码区）
>
> 用`abi.encode(myNum,myAddr)`返回一个`bytes`，长度始终是 32 字节（64 个 hex 字符）的整数倍，比如这里两个参数就回拼接得一个 64 字节（128 个 hex 字符）的`bytes4`，如果是数组/string 作为参数，则稍微复杂一点，但都是 n\*32 字节（64n 个 hex 字符）长的`bytes`
>
> 你还可以把这个`bytes`通过`abi.decode()`解码回来
>
> ##### 拼接 selector 和 ABI 编码区 => payload
>
> 用`abi.encodePacked(selector, abi)`可以得到完整的 calldata，结果依然是`bytes`类型，一般把这个变量叫**“payload”**
>
> ##### 一步到位拼接
>
> ##### 方式一：encodeWithSignature
>
> 用`abi.encodeWithSignature(string_of_functionCall, v1, v2...)`
>
> ```solidity
> // 	注意这里的uint256不能简写为uint
> bytes memory payload = abi.encodeWithSignature(
>     "foo(uint256,address)", // 函数签名
>     x,
>     user
> );
> ```
>
> ##### 方式二：abi.encodeWithSelector
>
> 先手动计算 selector，再拼接，用`abi.encodeWithSelector`
>
> ```solidity
> // 跟上面encodeWithSignature方式完全等价
> bytes memory payload = abi.encodeWithSelector(
>     bytes4(keccak256("foo(uint256,address)")),  // selector
>     x,
>     user
> );
> ```
>
> ##### 方式三：abi.encodeCall
>
> 又或者你怕函数的文字签名实在容易写错，比如我就曾经犯过一个错误：
>
> ```diff
> // 函数签名不需要写存储位置memory/storage/calldata，只需要写类型
> - abi.encodeWithSignature("setData(string memory)", newData);
> + abi.encodeWithSignature("setData(string)", newData);
> ```
>
> ```solidity
> // 跟上面encodeWithSignature方式完全等价
> bytes memory payload = abi.encodeCall(
>     remoteContract.foo,  // 需要知道合约名，比如叫remoteContract
>     x,
>     user
> );
> ```

> [!tip]
>
> ##### 解码
>
> 上面提到的编码方式，就对应着解码这个逆过程，但是由于 Selector 是经过 keccak 算法加密的，理论上只能解码变量的值。
>
> 解码时候的要输入参数的类型，才能得到对应的解码后的变量
>
> ```solidity
> // 比如从call结果中得到了bytes memory rawData
> bytes memory playload = abi.encodeWithSignature("getData()");
> (bool success, bytes memory rawData) = callee.staticcall(playload);
> require(success, "staticcall function failed");
>
> // 解码得到uint
> uint data = abi.decode(rawData, (uint));
> ```
>
> ##### 事件
>
> 在使用定义事件`event`的时候，有一个叫`indexed`的关键词，可以把一些参数不仅给前端输送去，还能在 etherscan 的`log`里面看到记录下来的 Topic 和 Data，这两个就都是解码出来的，其中 Data 就可以比较容易看到这个变量，当然也还是 hex16 进制，可以拿去转一下，即能准确知道是什么值

---



## 交易底层-函数 call/delegatecall

拿到 payload 之后，相当于有了 calldata，那么我们可以做底层的调用`call`来模拟执行调用

```solidity
function callCount(Counter c) public {
		// 常规方式
		c.count();
}

function lowCallCount(address c) public {
		// 底层调用方式，与常规方式完全等价
		bytes memory methodData = abi.encodeWithSignature(“count()”);
		c.call(methodData); // 0x06661abd
}
```

> [!note]
>
> 注意常规方式（高级方式）和底层方式（低级方式）的差异
>
> - 准备工作：
>   - 前者要初始化得到合约对象；
>   - 后者需要合约地址和做 ABI 编码得到 payload
> - 写法：
>   - 常规用`合约实例.函数名()`；
>   - 底层用`合约地址.call(payload)`或者`合约实例.call(payload)`；
>   - 底层你用**合约实例**（比如用接口+合约地址初始化的实例）其实也底层会被转换成用**合约地址**来调用，因为这种方式反正都**不会帮你做类型检查**，其实你不用接口初始化，直接用地址都行
> - 返回：
>   - 常规看合约代码怎么写，可能没有返回；
>   - 底层一定会返回至少一个参数`bool success`，告诉你底层调用是否成功，只要没有触发函数代码的 revert 和 require 异常就都能返回，这意味着**如果 out of gas 也会返回`true`，**但是实际上也没有成功、**甚至合约地址不存在也会返回`true`**，因为没有触发异常。

### 底层参数的更多自由度

- `(bool success, bytes memory result) = addr.call(payload)`
- 输入：playload，用 encode 后的 bytes
- 输出：bool success + 函数的返回值

#### 自由一：通过函数签名做参数来调用

因为有时候你要调用的合约都还没写，你可以把 payload 做参数给函数

```solidity
// 我要远程调用合约A，但是还不知道它怎么实现
function callWithPlayload(address contractAddr, bytes memory playload) public returns(bool) {
	(bool success,) = contractAddr.call(playload);
	return success;
}
```

#### 自由二：指定交易（调用）的 msg.value

比如**transfer 方法限制 gas 为 2300**，多了就会失败（但不会报错），而底层调用方法**没有 gas limit**除非你显式指定 gas 数字

```solidity
// 常规调用
addr.transfer(1 ether);

// 指定交易金额或gas limit
addr.call{value: 1 ether}(new bytes(0));
addr.call{value: 1 ether, gas: 1000000}(new bytes(0));
```

#### 自由度三：指定上下文

- `call()` 切换上下文，msg.sender 由 EOA 变成了本合约，远程的函数就像被一个代理合约调用了一样。
- `delegatecall()` 不切换上下文，仿佛直接把远程函数的代码粘贴到本合约的本函数运行一样。

> [!caution]
>
> ##### 对于涉及状态变量的执行
>
> - `call`只会让远程合约的状态变量变化，因为函数其实还是在远程合约的空间运行
> - `delegatecall()` 只会让本合约的同名状态变量变化，相当于把代码沾到本地合约空间中运行
>
> ##### 对于涉及转账
>
> - `call()` 中`msg.sender`就是本合约地址，远程的`payable(msg.sender).transfer`会把钱转到本合约，就算你本合约函数不写 payable，只要有`receive()`就能收
> - `delegatecall()`中`msg.sender`就是本 EOA，远程的`payable(msg.sender).transfer`会把钱转本 EOA 钱包
>
> ##### 对于仅仅涉及调用远程 view 函数
>
> - 可以使用`staticcall()`就行，跟`call()`一样，函数也会在远程的合约空间中运行，当然使用`call()`也行，不过`staticcall()`在调用**非 view 函数**的时候会自动报错禁止然后 revert

---



## 库library

- 定义 `library Extend {}`，使用用`using Extend for ...`
- 与合约类似，是函数的封装
- 库没有状态变量，不能收ether
- 库的函数有`external`/`public`的话，需要单独部署并委托调用
- 如果库函数全部是`internal`，使用它的话库代码会嵌入和合约

#### 示例一：内嵌库（99%的用法）

拓展uint的方法

```solidity
library SafeMath {
  function add(uint x, uint y) internal pure returns (uint) {
    uint z = x + y;
    require(z >= x, "uint overflow");

    return z;
  }
}

// 如果不在同一个文件内需要导入
// import "path/to/SafaMath.sol"

contract TestLib {
	// using SafeMath for uint; 如果是语法糖写法要先声明

	function testAdd(uint x, uint y) public pure returns (uint) {
		// x.add(y); 和下面等价，是语法糖写法，add自动把x当第一个参数
		uint sum = SafeMath.add(x, y);
		return sum;
	}
}
```

> [!note]
>
> 因为SafeMath只含有internal函数，所以**不需要先部署库**，使用库就相当于把库代码复制了一份进去，这种只含有internal函数的是库最主要的用法

#### 示例二：链接库（1%的用法）

当库含有了external或者public方法，那么就需要部署，然后才能被使用，这样看来的话跟**继承**的用法完全重复，也丧失了library设计之初的优点（效率高、安全性高）。

> [!tip]
>
> 如果是internal函数，编译后会触发內联，不会触发delegatecall的gas消耗
>
> 如果是external/public函数，编译后会生成delegatecall的操作，会触发等同于delegatecall的委托调用，按delagatecall收取gas费。

---



## EIP/ERC

- EIP：以太坊改进提案
- ERC：以太坊应用标准

### ERC20（同质化代币）

- 定义：最常用的代币标准（interface接口）
- 区别：与ETH是Coin不同，ERC20属于token
- 现存清单：[目前所有ERC20](https://etherscan.io/tokens)
- 内容：统一了函数名、名称、发行量、转账函数、转账事件，以便交易所集成
  - string name表示名称、string symbol表示代表缩写、uint8 decimals表示小数位数、uint totalSupply表示发行量
  - 用一个mapping(address => uint) balanceOf 表示所有人对这个token的余额
  - 用一个mapping(address => mapping(address => uint)) allowance表示了A地址给各个地址的授权额度（授权额度可以大于余额）
  - 函数transfer(address _to, uint _value)表示转账，需要本人才能用这个函数
  - 函数transfer(address _from, address _to, uint _value)表示授权转账，是由授权人发起的对别的地址的转账
  - 函数approve(address _spender, uint value)表示授权额度，需要由本人授权别人

> [!note]
>
> > 问：deposit函数是{from 我，to bank}对吧？但是函数里的token.transfer又变成{from bank, to tokenAddr}，我时常搞不清，我以为同一个函数里的所有交易在calldata上面表示就都是from msg.sender也就是我，这不对吗？
>
> 答：外部交易 vs 内部消息调用
>
> - 外部交易
>
>   `Tx: { from: 你的EOA, to: Bank合约, data: deposit(_amount) }`
>
> - 进入 `deposit` 函数后，`msg.sender`＝你的EOA。
>
> - 然后你在 `deposit` 里写了 `token.transferFrom(msg.sender, address(this), _amount)`，这会触发一次对 ERC‑20 合约的**“内部调用”**：
>
>   `MessageCall: { from: Bank合约, to: Token合约, data: transferFrom(你的EOA, Bank合约, _amount) }`
>
> - 在这次内部调用里，`msg.sender`＝Bank合约，而不是你的EOA；ERC‑20 合约会检查 `allowance[你的EOA][Bank合约]`，然后把代币从你的EOA划给 Bank。

---



## OpenZepplin

