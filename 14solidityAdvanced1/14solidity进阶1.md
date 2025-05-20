# 14 Solidity Advance

## 函数修改器 modifier 

>  [!note]
>
>  本质上是一个语法糖，编译期间就回拓展到函数的实现，所以其实只是帮你复制代码到各个函数上面，然在部署时候，msg.data编译的合约总字节码不可以超过2kb，所以要考虑情况使用。

#### 案例一，不带参数

```solidity
// 最常见的函数修改器
modifier onlyOwner() {
	require(msg.sender, 'Only owner can call!');
	_;   // 这个下划线就代表被他修饰的函数的运行占位
}

// 然后就可以在函数中使用
function withdraw() public onlyOwner {
	// 收回本合约中所有的钱
	payable(msg.sender).transfer(address(this).balance);
}
```

#### 案例二，带静态参数

```solidity
// 带参数的modifier
modifier mustMoreThan(uint amount) {
	require(address(this).balance > amount, 'Only when it's enough');
	_;
}

function withdraw() public onlyOwner mustMoreThan(1 ether) {
	// 收回本合约中所有的钱，但是需要合约余额大于1 ether才可以提取
	payable(msg.sender).transfer(address(this).balance);
}
```

#### 案例三，带函数的参数

```solidity
modifier over22(uint age) {
	require (age >= 22, "too small age");
	_;
}

// 因为语法糖的原因，其实修改器可以直接拿到函数的输入参数变量
function marry(uint age) public over22(age) {
	// do something
}
```

---



## 回退revert

> [!note]
>
> 为了保证事务性，solidity中条件不符合导致revert和require触发的时候，会回退，相当于这个函数没有执行过，但是gas费不会退还。

### require

- `require(condition[, "some message"]);`
- 优点：在**函数体内**定义的一行文，错误信息会直接返回给前端
- 缺点：把错误信息文本打包进字节码，部署的时候msg.data浪费空间（珍贵的2kb总量）

### revert（可配合error）

> 0.8.4之后才有revert这个关键词

##### 案例一带string：if (condition)  revert(“some message! ”) ;

- 优点：函数内一行文，与上面的require一行文完全等价，错误信息也会返回给前端
- 缺点：同require，浪费字节码空间
- 被catch时候体现为`Error("some message")`

##### 案例二自定义error：先定义error再在函数内revert Error()

```solidity
// 某合约内
error Unauthorized(); // 第一行
function withdraw() public {
  if (msg.sender != owner)
    revert Unauthorized(); // 第二行

    payable(msg.sender).transfer(address(this).balance);
}
```

- 节省Gas，回退时抛出
- 被catch时候标签为`bytes`，比案例一节省gas
- 底层是因为这个错误的selector被压缩为极短的独一无二的字节码`bytes4(keccak256("Unauthorized(...)")`，即使自定义错误里面有参数，那也是很省空间的
- 而案例一或者require都要保存string字节码，抛出异常时候，从常量拷贝到内存，再打包到returndata里面给出

#### :star: 小总结

有字符串的revert和require     **VS**    revert+自定义error

| 方式                        | 部署成本（字节码大小） | revert 时内存操作  | revert returndata 大小 | 适合场景                        |
| --------------------------- | ---------------------- | ------------------ | ---------------------- | ------------------------------- |
| `require(cond, "…string…")` | 较大 (字符串常量)      | 拷贝字符串到内存   | 包含完整字符串         | 快速原型、小合约示例            |
| `revert CustomError(...)`   | 小 (仅 selector)       | 仅写 selector+参数 | 4 byte selector＋参数  | 生产级、追求最优 gas 的合约设计 |

---



## 错误处理try catch

一般在远程调用中，需要用到try，因为你不知道对方合约会有什么类型的报错，可能

1. 带文字的如require(condition, msg)或revert(msg)
2. 带自定义error之后主动抛出的revert CustomError()

```solidity
// try 需要写在合约的函数里
// 记得这个合约对象需要先进行初始化，用接口初始化或new初始化

bool remoteIsSuccess;

// 远程用别人的函数，需要声明他将会返回什么，这个你在外部合约的接口可以看到
try remoteContract.widraw(amount) returns(bool isSuccess) {
	remoteIsSuccess = isSuccess;

// 对于带文字的错误，要用这个Error类来接，你可以这样接到对应的文本
} catch Error(string memory err) {
	// do something
	
// 对于自定义的CustomError()就要
} catch (bytes memory reason){
  // 然后就拿到了bytes格式的reason，其实是abi编码，需要手动解码
}
```

> [!tip]
>
> 一般来说用两个catch就可以，就像上面的例子一样

---



## 事件event

```solidity
contract learnEvent {
    receive() external payable {}
		
		// 一、定义事件
    event MoneyUp(address indexed sender, uint amount);
    function getMoreMoney() public payable {
    		// 二、触发事件
        emit MoneyUp(msg.sender, msg.value);
    }
}
```

- `event CustomEvent()`来在函数外定义
- 可以带多个参数，比如`event CustomEvent(address sender)`
- 可以带`indexed`这样在log里就可以被索引

##### 例子中的call之后的log会呈现如下：

```json
{
	"from": "0x589E276e8d27050387862DCE3986E6Fca3ae83Af",
	"topic": "0xb4a0321935d78d0f1260708dea593a156064ccc48deece7e34c93fef97f1c4cb",
	"event": "MoneyUp",
	"args": {
		"0": "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
		"1": "1000000000",
		"sender": "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
		"amount": "1000000000"
	}
}
```

---



## 接口/继承

> [!NOTE]
>
> 虽然都是用is来表示实现接口和继承合约，但是：
>
> 1. 接口是原合约给外部用的，只写public和external的函数，不能写状态变量和特殊函数
> 2. 继承合约是除了private的函数都能拿来直接用

#### 一、接口

```solidity
contract A {
	uint public count = 0;
	function add() public {
		count += 1;
	}
}

// 接口定义
interface IA {
	function count() external returns(uint);
	function add() external;
}

// A合约部署后，就可以拿合约地址给IA来得到对象，然后远程调用
contract B {
	// 远程调用后，A的count就会实现+1
	function remoteCallAdd(address remoteAddr) public {
		// 把IA想象成一个合约类型，然后给地址来初始化
		IA remoteContract = IA(remoteAddr);
		remoteContract.add();
	}
}
```

- 表示对`SomeContract`的所有函数（特殊函数modifier、constructor、receive不算）的描述，但是不要把写大括号，因为不需要知道函数的实现
- 表示对所有新定义的`struct`、`enum`的完整描述（直接从合约代码搬过来）
- 所有的列出来的函数即使在原合约里是public，都要写成external，如果是internal或者private就不允许写出来
- 不需要写事件event，但是你也可以写
- 接口是不能继承自接口的

#### 二、继承

```solidity
contract A { // 合约
	uint public count = 0;
	function add() public virtual {
		count += 1;
	}
}

interface IA { // 接口
	function count() external returns(uint);
	function add() external;
}

abstract contract absA{ // 抽象合约
  uint public count = 0;
  function add() public {
      count += 1;
  }
  // 抽象合约意思就是说，你必须实现所有的virtual
  function showBalance() public virtual returns(uint);
  function addMore() public virtual;
}

// 一、继承接口的话，要把状态变量等的都实现，因为接口里面没有
contract AAI is IA {
    uint public count = 0; // 没有写这句编译器会报错
    function add() public override {
        count += 5;
    }
}

// 二、继承合约的话，可以直接用父合约的状态变量
contract AA is A {
	function add() public override {
		super.add();  // 可以先执行一遍原来的add（+1）
		count += 2;  // 然后继续+2，效果就是每次调用实际是+3
	}
}

// 三、继承抽象合约，必须实现完所有的virtual，而已经实现的可以直接用
contract AAabsA is absA {
    function showBalance() public view override returns(uint) {
        return count;
    }
    function addMore() public override {
        count += 10;
    }
}
```

- 可以继承一个接口，也可以继承一个合约，也可以继承一个抽象合约
  - 继承接口的话编译器要求你把所有external空函数都要实现
  - 继承抽象函数的话仅仅要求把带virtual的空函数全部实现
  - 继承合约的话你可以仅仅修改某些函数，甚至不修改
- 继承时候一般要给函数写一个`override`修饰符，更优雅
- 父合约中那些本来就设计好了要被重写的合约应该加上`virtual`，更优雅
- `super.add()`表示先运行一遍父合约的add，

#### :star:速记

| 场景                                           | 推荐关键字          | 说明                                     |
| ---------------------------------------------- | ------------------- | ---------------------------------------- |
| ✅ 你希望合约马上部署上线                       | `contract`          | 可完整部署，包含状态变量 + 函数逻辑      |
| ✅ 你希望定义一个**规则和部分逻辑供子合约复用** | `abstract contract` | 允许有未实现函数，不能直接部署           |
| ✅ 你希望只提供最简函数签名供远程调用/标准化    | `interface`         | 只能包含函数签名、不能有状态变量或实现体 |

> [!important]
>
> receive函数的继承：没法直接继承，想要复用父合约函数逻辑，你要把它包装成一个onReceive函数，然后用来代替`super.reveice()`，因为receive是没法被主动调用的。
>
> constructor函数的继承：也没法直接继承，想要复用需要把父合约当成修饰符给到子合约的`constructor`：
>
> ```solidity
> contract Child is Parent {
>     constructor() Parent(42) {
>         // 这里必须明确给父构造函数传参
>     }
> }
> ```



## 库 Library

> library
>
> 1. 没有内存空间，所以没有所谓的地址、状态变量，上下文msg等所有变量
> 2. 仅仅提供函数方法

一、openZeppelin