// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MyToken is ERC20 { 
    address public deployer;
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        _mint(msg.sender, 1e10*1e18);
        deployer = msg.sender;
    } 

    function sender() public view returns(address){
        return msg.sender;
    }
}