// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MyToken is ERC20, ERC20Permit {
    constructor() ERC20("Ptoken", "PET") ERC20Permit("Ptoken") {
        _mint(msg.sender, 1e10);
    }
}

contract tokenBank {
    // 记账
    mapping(address => uint) public balanceOf;
    // 收款类型
    ERC20 public token;
    ERC20Permit public permitToken;
    address public owner;

    // 初始化
    constructor(address _tokenAddr) {
        token = ERC20(_tokenAddr);
        permitToken = ERC20Permit(_tokenAddr);
        owner = msg.sender;
    }

    // deposit 传统的方法，需要token那边先approve
    function deposit(uint amount) public  {
        // 需要用户自己先去token合约做approve，这条才通过
        require(token.allowance(msg.sender, address(this)) >= amount, "Bank need more approve amount.");
        // 转移并记账
        token.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;       
    }

    // deposit 用需要vrs签名的premit
    function depositWithPermit(
        address user,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        // 任何人只要手握vrs签名就可以执行，所以没有require，
        permitToken.permit(
            user,                   // 所有者
            address(this),          // 被授权者（当前合约）
            amount,                 // 授权金额
            deadline,               // 签名过期时间
            v, r, s                 // 签名组件
        );
        // 如果上面的permit没有revert，那就转移+记账
        // 注意执行者不一定就是user，所以写user就行
        token.transferFrom(user, address(this), amount);
        balanceOf[user] += amount;
    }

    // 银行退钱
    function withdraw() external {
        uint amount = balanceOf[msg.sender];
        require(amount > 0, "No balance");
        // 只能操作自己的账户
        balanceOf[msg.sender] = 0;
        token.transfer(msg.sender, amount);
    }
}