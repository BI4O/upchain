// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/*
• 编写一个 Vesting 合约(可参考 OpenZepplin Vesting 相关合约), 相关的参数有:
• beneficiary: 受益人
• 锁定的 ERC20 地址
• Cliff:12 个月
• 线性释放:接下来的 24 个月
• 从 第 13 个月起开始每月解锁 1/24 的 ERC20
• Vesting 合约包含的方法 release() 用来释放当前解锁的 ERC20 给受益人
• Vesting 合约部署后,开始计算 Cliff ,并转入 100 万 ERC20 资产
*/

import "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    address public owner;
    constructor() ERC20("VestToken","VT") {
        owner = msg.sender;
        _mint(owner, 2e6 ether); // 200w枚
    }
}

contract Vasting {
    address[] public beneficiary;
    Token public token;

    uint public constant CLIFF_MONTHS = 12;
    uint public constant TOTAL_MONTHS = 24;

    uint public deploytime;
    uint public releaseCount = 0;
    uint public releaseAmountForEach;
    bool public injected = false;

    constructor(address _tokenAddr,address[] memory _beneficiary) {
        token = Token(_tokenAddr);
        require(msg.sender == token.owner(), "Only token owner can launch!");
        beneficiary = _beneficiary;
        // deploytime 和 releaseAmountForEach 延后到 inject()
    }

    function inject() public {
        require(!injected, "Already injected");
        require(msg.sender == token.owner(), "Only token owner can inject");
        token.transferFrom(msg.sender, address(this), 1e6 ether);
        releaseAmountForEach = 1e6 ether / TOTAL_MONTHS;
        injected = true;
        deploytime = block.timestamp;
    }

    function release() public {
        require(injected, "Not injected yet");
        uint monthsPass = (block.timestamp - deploytime) / 30 days;
        require(monthsPass >= CLIFF_MONTHS, "No release during cliff time!");
        require(releaseCount < TOTAL_MONTHS, "All release done");
        uint shouldReleaseCount = monthsPass - CLIFF_MONTHS + 1;
        if (shouldReleaseCount > TOTAL_MONTHS) {
            shouldReleaseCount = TOTAL_MONTHS;
        }
        uint toRelease = shouldReleaseCount - releaseCount;
        require(toRelease > 0, "No tokens to release yet");
        uint totalAmount = toRelease * releaseAmountForEach;
        uint amountPerBeneficiary = totalAmount / beneficiary.length;
        for (uint256 index = 0; index < beneficiary.length; index++) {
            token.transfer(beneficiary[index], amountPerBeneficiary);
        }
        releaseCount += toRelease;
    }
}