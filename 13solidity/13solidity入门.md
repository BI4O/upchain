# 13 Solidity

## 合约 Contract

必要的组成

```solidity
pragma solidity ^ 0.8.0 // 1.编译版本

contract Counter {      // 2.定义合约
	uint public counter;  // 3.状态变量
	constructor() {       // 初始化函数，可略
		counter = 0;
	}
	function count() public { // 4.合约函数
		counter += 1;
	}
}
```

> [!note]
>
> 合约也是一种类型，创建合约可以用地址来创建，比如你有合约的接口+部署了的地址，那么就可以
>
> `IContract public contr = IContract(addr)`
>
> 这样来创建一个合约对象，然后用
>
> `contr.someFunc()`
>
> 在某合约代码里远程调用这个合约的方法

---



## 变量 Variable

> [!note]
>
> ###### 格式：`变量类型 [可见性][可变状态] 变量名 [赋值]`
>
> 可见性：
>
> 1. public 合约内外都可见
> 2. private 只有当前合约可以用，继承和调用的都不可见
> 3. internal 当前合约内 + 继承本合约的合约可见
>
> 可变状态，一般用全大写标识：
>
> 1. constant 不可修改的定量，定义的时候赋值之后再也不可变
> 2. immutable 不可修改的定量，定义的时候不赋值，合约初始化的时候赋值



#### 一、值类型

- ##### 整型

  - `unit public count = 100;`
  - uint(uint256)、uint8、uint16
  - +加，-减，*乘，/除，%取余数，\*\*幂（3\*\*2 相当于3的2次方）
  - 当你觉得这个数不会超过256的时候，可以用uint8，比如岁数，否则一律用uint

- ##### 布尔

  - `bool public isOpen = true;`
  - 只能true或者false
  - ==等于，!=不等于，![bool]取反
  - [bool]&&[bool] 且，[bool]||[ bool]或
  - 常与if else结合使用 if ([bool]) {...}

- ##### 地址类型

  - `address public myAddr;`
  - `address payable public myPayAddr;`
  - 一个20字节的值
  - payable的地址可以使用 addr.transfer()或 addr.send()来接收钱
  - 可以用payable(addr)来做类型转换
  - addr.balance可以返回uint的地址的余额
  - transfer失败会返回异常，send失败会返回false
  - 每发起一次转账，EVM低消2300gas，对方代码的receive函数可以用一些，但是多了要补，少了不会退。
  - 你发起transfer(1 ether)其实你要消耗1ether+你的这个函数的gas fee+对方receive函数的gas fee(>= 2300gas)，而对方会完整收到1ether
  - 可以用address(this)把this这个合约类型转换为地址类型，也就是合约的地址

- ##### 枚举

  - `enum Color = {Red, Blue, Gray};`来创建这个类别
  - 然后就可以`Color myColor`这样创建变量myColor
  - 你可以自己创作单词，不用加引号
  - 枚举成员从0开始，不能多于256个成员
  - 用`type(Color).max`和`type(Color).min`可以返回最后和最前的这个enum的成员

- ##### 自定义类型

  - `type timeStamp is uint;`
  - 其实就是给数字或别的类型别名，让函数的可读性提升

#### 二、引用类型

> [!note]
>
> 引用类型赋值 = 拷贝
>
> 在函数的输入参数、输出参数、内部定义中，都需要声明存储位置
>
> 1. memory：只在函数调用期间
> 2. storage：同名的变量变动，会使得函数外的状态变量也发生变化
> 3. calldata：调用数据，只在external函数的输入参数重使用
>
> 速记，尽量一直都用memory，实在要优化才把一些memory改为calldata

- ##### 数组

  - `uint[10] public tens;`定长数组

  - `unit[] public numbers;`不定长，动态调整

  - 可以用下标访问`number[0]`表示第一个元素

  - 在函数使用数组不用写可见性，但是要写存储位置，比如memory：`uint[] memory `

  - 常用方法/属性

    - length，返回uint格式的长度数字
    - push()，添加零元素到末尾，并返回应用（注意跟py的append不一样）
    - push(item)，末尾添加一个新元素
    - pop()，末尾删除第一个元素
    - 不能通过delete numbers[1] 这样来删除，如果实在要删需要手动把右边的数据往左挪

  - > [!caution]
    >
    > 永远不要想着在合约代码中遍历整个数组来做点什么，gas会非常高，虽然view和pure函数是不需要调用者gas fee的，但是EVM对一个交易（一次函数调用）是有gas limit的，比如EVM是3700万gas，而且你的免费交易因为没有tips会优先级非常靠后，导致很慢。小的十几个的元素的循环是可以接受的，多的尽量用链下聚合方式

- ##### 字符串/字节类型（其实是特殊的数组）

  - `string public myStr = 'hello';`
  - `bytes public myStr = bytes('hello');`
  - bytes比string更省gas和空间
  - 合并string用`string memory longStr = string.concat(str1,str2);`
  - 合并bytes成string用`string memory longStr = srting(absencodePacked(b1,b2));`

- ##### 结构体

  - ```solidity
    struct Person {
    	address acount;
    	bool gender;
    	uint8 age;
    }
    ```

  - 结构体是定义一个新的类型，你还需要赋值来初始化(一般是在函数中用)

    - `chairman = Person(acc,gd,age);`修改状态变量and简单初始化，因为是状态变量，其实是storage方式改变了函数外的charman状态变量
    - `Person memory person = Person({gender:h, account:acc, age:age});`函数中新建临时变量person，所以是memory，不影响函数外的合约状态变量

  - 函数中是否该使用storage？

    - 少量改动，直接用状态变量chairman来改
    - 多次改动，storage 引用`Person sotrage p = chairman`，然后用p.xx = xx来改动，实时反映到chairman状态变量上。
    - 复杂临时计算，memory 然后整体赋值。

    | 场景         | 最佳写法                                           | data location  | 理由                       |
    | ------------ | -------------------------------------------------- | -------------- | -------------------------- |
    | 单字段更新   | `chairman.age = …;`                                | 默认 storage   | 简洁，状态直写             |
    | 多字段更新   | `Person storage p = chairman; p.x=…; p.y=…;`       | storage        | 只读一次，写多次，最省 gas |
    | 复杂临时计算 | `Person memory tmp = chairman; …; chairman = tmp;` | memory→storage | 内存运算后整体写回         |

#### 三、映射

- `mapping(address => uint) public balances;`
- 比较常用的是用uint或者address来 => struct来结合着使用
- 可以用下标来访问`balance[anyAddr]`

---



## 函数 function

> [!note]
>
> #### function 函数名([参数列表]) 可见性 [可变性] [returns(返回值)]

### 一、函数-可见性

- public 合约内外都可用，继承也可以用
- external 仅合约外访问，内部不能用函数名直接访问（但可以用this.func()访问）
- internal 内部和继承的子合约都可以用，接口上面不用写给别人看
- private 仅仅本合约内可用，接口上也不用写给别人看（很少用）

### 二、函数-状态可变性

- view 函数只读，不消耗手续费，但是EVM会限制gas

- pure 函数仅仅计算

- payable 函数可以网合约里面存钱

  - receive() external payable是固定搭配，最常见的往合约存钱payable函数
  - fallback() payable 这个函数带了payable就可以往合约存钱
  - function deposit() public payable 虽然不是内置关键函数，但是常用来做receive的内核函数，这样继承合约就可以继承父合约的receive函数了（其实是把内核函数拿去放在子合约receive里面做override）

- mofifier 使用前需要先像一个函数一样定义

  - ```solidity
    contract C {
    	// 定义修改器
    	modifier myModi() {
    		require(...);
    		_;
    	}
    	
    	function someFunc() public view myModi {...}
    }
    ```

- 可变性声明可以有很多个，而且顺序没有限制

### 三、函数-函数调用

- 内部调用和外部调用
- 内部调用直接用函数名比如get()
- 外部调用可以：contractAddr.func()，或者本合约内用this.func()
  - 可以不用小括号而用大括号来指定发送value和gas：{value: 10, gas: 10000}
  - 但是不建议指定gas，这样可能会导致调用失败，而gas是不会返还的
- 内部调用高效，因为在同一个EVM环境（类似一个容器），但是外部调用却需要切换上下文（类似两个容器交流）

### 四、特殊的函数

- 不用function关键词的
  - getter：不需要定义，public的变量自带
  - constructor：初始化函数
- 不用function关键词，且为回调函数
  - receive：一般没有输入参数，固定搭配`receive() external payable {}`
  - fallback：EVM在应对外部调用函数，没有找到该函数名时候调用，以及外部调用函数的时候如果有msg.data附带（有钱）且fallback有payable状态可变性的时候，可以接收到这些value（钱）
  - 如果连fallback都没有，而远程又调用了一个不存在的函数，则会报错

---



## 通用变量 Global Variable

- ##### block
  
  - block.number：uint当前区块号
  - block.timestamp：uint起始区块到当前区块以秒计的时间戳
- ##### msg
  
  - msg.sender：address调用者的地址，可能是eoa钱包，也可能是一个合约地址
  - msg.value：unit随消息发送的wei的数量（10^18 Wei = 1 ether）
  - msg.data：“消息荷载”，一般来说就是完整的调用信息，如果是合约创建则是整个合约代码字节码，加上初始化函数的参数
  - msg.sig：仅仅当合约某函数被调用时候有值，就是函数名字节码前四个字节
- ##### tx
  
  - tx.origin：address payable交易的发起者

---



## 交易transaction

| 场景                                     | 外部交易三个字段                                             | 合约中读取到的                                               | 简要大白话说明                                               |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | :----------------------------------------------------------- |
| **A. 简单转账 (EOA → EOA)**              | - `to`：目标外部账户地址<br>- `value`：1 ETH（假设）<br>- `data`：`0x`（空） | — 没有合约参与，`msg.*` 在合约里根本不会出现。               | 你就是给一个人转钱，对方不是合约，链上只改余额，没有执行任何合约代码。 |
| **B. 合约函数调用 (EOA → Contract.foo)** | - `to`：合约地址<br>- `value`：0.5 ETH（假设）<br>- `data`：<br>`0xa9059cbb…000000…0005f5e100`<br>(4 字节 selector + 参数编码) | 在 `foo` 内部：<br>- `msg.sender` = 你的 EOA<br>- `msg.value` = 0.5 ETH<br>- `msg.data` = 整个字节流 `0xa9059cbb…000000…0005f5e100` ([docs.soliditylang.org][1])<br>- `msg.sig` = `0xa9059cbb` (前4字节)([docs.soliditylang.org][2]) | 这笔交易告诉合约“调用 foo(...) 这个函数，参数是 X，顺便给它 0.5 ETH”。`msg.data` 就是把“我想调用哪个函数、给什么参数”打包后的全部内容；`msg.sig` 仅是前 4 字节，表示“方法号”。 |
| **C. 部署合约 (EOA → new Contract)**     | - `to`：`null`<br>- `value`：0 ETH 或者带一点 ETH<br>- `data`：<br>“初始化 initcode + 构造函数参数” | 在构造函数里：<br>- `msg.sender` = 你的 EOA<br>- `msg.value` = 附带的 ETH（若有）<br>- `msg.data` = 整个 initcode 包 + 构造参数编码 ([docs.soliditylang.org][1]) | 你不是在调用现有函数，而是在告诉 EVM：“这是我新合约的程序（+构造参数），请给它创建一个地址并运行这段代码”。`msg.data` 就是那大包程序和参数。 |

- **EOA之间的转账交易**是最接近BTC的原理的，只有两头的地址加转账金额
- **EOA调用合约的函数**，如果是可以附带value金额的，所有的金额都会被合约接收（除非对面的receive函数没有，或者对应的函数没有写payable）
- **EOA调用合约的函数**附带的value金额，会全部进入合约余额，不需要在函数内特别声明`payable(address(this)).transfer(msg.value)`，这句话是多余的但不会报错，即使你硬要写，比如说想要只接受一半另一半退回，那也是不会实现的。
- **EOA部署合约**的时候，是可以带value金额的，但前提是合约的constructor函数要带payable关键词