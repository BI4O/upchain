pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("MyToken","MT") {}
    
    // 添加铸币功能用于测试
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}