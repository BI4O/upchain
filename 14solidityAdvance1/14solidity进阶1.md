# 14Solidity Advance

## 三种交易

> {
>
> to: 
>
> data: 
>
> value: 
>
> }

## 回退/错误处理



## 事件



## 接口/继承

>  

#### 一、接口

- `interface ISomeContract {}`
- 表示对`SomeContract`的所有函数（特殊函数不算）的描述，但是不要把写大括号，因为不需要知道函数的实现
- 表示对所有新定义的`struct`、`enum`的完整描述（直接从合约代码搬过来）

#### 二、继承

## 库

> library
>
> 1. 没有内存空间，所以没有所谓的地址、状态变量，上下文msg等所有变量
> 2. 仅仅提供函数方法

一、openZeppelin