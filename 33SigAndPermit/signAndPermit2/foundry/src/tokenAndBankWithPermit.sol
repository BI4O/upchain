// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol"; // permit1 需要
import "permit2/src/interfaces/IPermit2.sol"; // permit2 需要
import "permit2/src/interfaces/ISignatureTransfer.sol";

contract MyToken is ERC20 /*, ERC20Permit*/ { // permit1 需要继承ERC20Permit
    constructor() ERC20("Ptoken", "PET") /*ERC20Permit("Ptoken")*/ { // permit1 需要ERC20Permit构造
        _mint(msg.sender, 5000 ether);
    }
}

contract tokenBank {
    // 记账
    mapping(address => uint) public balanceOf;
    // 收款类型
    ERC20 public token;
    // ERC20Permit public permitToken; // permit1 需要
    IPermit2 public permit2; // permit2 需要
    address public owner;

    // 初始化
    constructor(address _tokenAddr, address _permit2) {
        token = ERC20(_tokenAddr);
        // permitToken = ERC20Permit(_tokenAddr); // permit1 需要
        permit2 = IPermit2(_permit2); // permit2 需要
        owner = msg.sender;
    }

    // deposit 传统的方法，需要token那边先approve
    function deposit(uint amount) public  {
        require(token.allowance(msg.sender, address(this)) >= amount, "Bank need more approve amount.");
        token.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;       
    }

    /*
    // deposit 用需要vrs签名的permit1（原始ERC20Permit）
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
    */

    // depositWithPermit2 用 permit2 授权+转账
    // 与permit1的区别：
    // 1. 不再需要v, r, s参数，改为permit2的签名（bytes类型）
    // 2. 直接通过permit2合约完成授权和转账，无需先permit再transferFrom
    function depositWithPermit2(
        address user,
        uint256 amount,
        uint256 deadline,
        bytes calldata permitSignature
    ) public {
        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: address(token),
                amount: amount
            }),
            nonce: 0,
            deadline: deadline
        });

        ISignatureTransfer.SignatureTransferDetails memory transferDetails = ISignatureTransfer.SignatureTransferDetails({
            to: address(this),
            requestedAmount: amount
        });

        permit2.permitTransferFrom(
            permit,
            transferDetails,
            user,
            permitSignature
        );

        balanceOf[user] += amount;
    }

    // 银行退钱
    function withdraw() external {
        uint amount = balanceOf[msg.sender];
        require(amount > 0, "No balance");
        balanceOf[msg.sender] = 0;
        token.transfer(msg.sender, amount);
    }
}