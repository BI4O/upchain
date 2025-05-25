// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    address public owner;
    constructor() ERC20("AutoWithdraw","AT"){
        owner = msg.sender;
        _mint(owner, 1e10 ether);
    }
}

contract TokenBank {
    Token public token;
    mapping(address => uint) public balances;

    constructor(address tokenAddr) {
        token = Token(tokenAddr);
    }

    function deposit(uint _amount) public {
        require(token.allowance(msg.sender, address(this)) >= _amount, "bank unauthorized");
        require(token.balanceOf(msg.sender) >= _amount, "balance exceed");
        bool success = token.transferFrom(msg.sender, address(this), _amount);
        require(success, "transfer failed");
        balances[msg.sender] += _amount;
    }

    function withdraw() public {
        require(balances[msg.sender] > 0, "balance is empty");
        bool success = token.transfer(msg.sender, balances[msg.sender]);
        require(success, "withdraw failed");
        balances[msg.sender] = 0;
    }

    function excuateWithdraw(address user, uint amount) public {
        require(balances[user] > 0, "balance is empty");
        bool success = token.transfer(user, amount);
        require(success, "auto withdraw failed");
        balances[user] -= amount;
    }
}

contract autoWithdraw {
    Token private _token;
    TokenBank private _tokenBank;

    uint public widrawTimes;
    address public watchAddr;
    uint public threshold;

    uint256 public immutable interval;
    uint256 public lastTimeStamp;

    constructor(address tokenAddr, address tokenBankAddr) {
        _token = Token(tokenAddr);
        _tokenBank = TokenBank(tokenBankAddr);
        widrawTimes = 0;
        watchAddr = msg.sender; // 我的mm钱包
        threshold = 500;

        // chainlink automation 定时20秒一次
        interval = 20;
        lastTimeStamp = block.timestamp;
    }

    function checkUpkeep(bytes calldata sth) external view returns(bool, bytes memory) {
        bool ok1 = (block.timestamp - lastTimeStamp) > interval;
        bool ok2 = _tokenBank.balances(watchAddr) >= 500; // 大于100就触发
        bytes memory withdrawAmountBytes = abi.encode(_tokenBank.balances(watchAddr) / 2); 
        return (ok1 && ok2, withdrawAmountBytes);
    }

    function performUpkeep(bytes calldata _withdrawAmountBytes) external {
        if ((block.timestamp - lastTimeStamp) > interval && _tokenBank.balances(watchAddr) >= 500) {
            uint withdrawAmount = abi.decode(_withdrawAmountBytes, (uint256));
            _tokenBank.excuateWithdraw(watchAddr, withdrawAmount);
            widrawTimes += 1;

            // chainlink
            lastTimeStamp = block.timestamp;
        }
    }  

}