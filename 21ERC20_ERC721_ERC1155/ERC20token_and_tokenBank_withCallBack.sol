// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BaseERC20 {
    string public name; 
    string public symbol; 
    uint8 public decimals; 

    uint256 public totalSupply; 

    mapping (address => uint256) balances; 

    mapping (address => mapping (address => uint256)) allowances; 

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        // write your code here
        // set name,symbol,decimals,totalSupply
        name = "BaseERC20";
        symbol = "BERC20";
        decimals = 18;
        totalSupply = 100000000;
        balances[msg.sender] = totalSupply;  
    }

    function balanceOf(address _owner) public view returns (uint256 balance) {
        // write your code here
        return balances[_owner];
    }

    function transfer(address _to, uint256 _value) public returns (bool success) {
        // write your code here
        require(balances[msg.sender] >= _value, "ERC20: transfer amount exceeds balance");
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);  
        return true;   
    }

    function transferWithCallBack(address _to, uint256 _value) public returns (bool success){
        // simple transfer
        transfer(_to, _value);

        // 再加一个使用Bank合约的远程调用功能
        if (_to.code.length > 0) {
            // 这里的msg.sender是token合约地址，所以Bank必须要知道跟他交互的是Token合约才能继续
            try TokenBank(_to).tokenReceive(msg.sender, _value) returns(bool result){
                require(result, "receiver not response true !!");
                return true;
            } catch {
                revert("Bank receiver funciton wrong!!");
            }
        }
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        // write your code here
        require(balances[_from] >= _value, "ERC20: transfer amount exceeds balance");
        require(allowances[_from][msg.sender] >= _value, "ERC20: transfer amount exceeds allowance");
        balances[_from] -= _value;
        allowances[_from][msg.sender] -= _value;
        balances[_to] += _value;
        
        emit Transfer(_from, _to, _value); 
        return true; 
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        // write your code here
        require(balances[msg.sender] >= _value, "approve: amount exceed");
        allowances[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value); 
        return true; 
    }

    function allowance(address _owner, address _spender) public view returns (uint256 remaining) {   
        // write your code here     
        return allowances[_owner][_spender];
    }
}

/*
编写一个 TokenBank 合约，可以将自己的 Token 存入到 TokenBank， 和从 TokenBank 取出。

TokenBank 有两个方法：

1.deposit() : 需要记录每个地址的存入数量；
2.withdraw（）: 用户可以提取自己的之前存入的 token。
*/

contract TokenBank {
    BaseERC20 public token;
    mapping(address => uint) public balances;

    constructor(address tokenAddr) {
        token = BaseERC20(tokenAddr);
    }

    function tokenReceive(address _from, uint _amount) public returns(bool) {
        require(address(token) == msg.sender, "tokenReceive must invoked by ERCtoken caontract!");
        balances[_from] += _amount;
        return true;
    }

    function deposit(uint _amount) public {
        // 先检查授权
        require(token.allowance(msg.sender, address(this)) >= _amount, "bank unauthorized");
        // 再检查余额
        require(token.balanceOf(msg.sender) >= _amount, "balance exceed");

        // {from: BankAddr, to: tokenAddr, data: sender money -> Bank}
        // 需要有sender的授权才可以转账（因为sender的余额不可以Bank来支配）
        bool success = token.transferFrom(msg.sender, address(this), _amount);
        require(success, "transfer failed");

        // 本银行中发送者余额增加
        balances[msg.sender] += _amount;
    }

    function withdraw() public {
        require(balances[msg.sender] > 0, "balance is empty");

        // {from BankAddr, to: tokenAddr, data: Bank money -> sender}
        // 因为是银行的地址来调用银行的转账，所以不需要授权（因为自己的余额可以自己支配）
        bool success = token.transfer(msg.sender, balances[msg.sender]);
        require(success, "withdraw failed");
        balances[msg.sender] = 0;
    }
}