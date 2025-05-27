// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.8.20;

import {ERC20} from "solmate/tokens/ERC20.sol";

contract Token is ERC20("TokenA", "TKA", 18) {
    constructor() {
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }
}