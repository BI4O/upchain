// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MemeToken {
    string public constant name = "Meme Token";
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    uint256 public perMint;
    uint256 public price;
    address public creator;
    address public factory;
    bool private initialized;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        // 构造函数不再设置factory，因为在代理模式下这不会被使用
    }

    // 初始化函数，由工厂合约调用
    function initialize(
        string memory _symbol,
        uint256 _totalSupply,
        uint256 _perMint,
        uint256 _price,
        address _creator,
        address _factory
    ) external {
        require(!initialized, "Already initialized");
        
        symbol = _symbol;
        totalSupply = _totalSupply;
        perMint = _perMint;
        price = _price;
        creator = _creator;
        factory = _factory;
        initialized = true;
    }

    // 铸造代币函数，只能由工厂合约调用
    function mint(address to, uint256 amount) external {
        require(msg.sender == factory, "Only factory can mint");
        
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        
        uint256 senderBalance = balanceOf[msg.sender];
        require(senderBalance >= amount, "Transfer amount exceeds balance");
        
        balanceOf[msg.sender] = senderBalance - amount;
        balanceOf[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "Transfer amount exceeds allowance");
        
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "Transfer amount exceeds balance");
        
        allowance[from][msg.sender] = currentAllowance - amount;
        balanceOf[from] = fromBalance - amount;
        balanceOf[to] += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
} 