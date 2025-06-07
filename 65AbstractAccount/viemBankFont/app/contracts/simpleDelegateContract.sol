// SPDX-License-Identifier: MIT
// code from : https://book.getfoundry.sh/reference/cheatcodes/sign-delegation#signature

pragma solidity ^0.8.17;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TokenBank } from "0505learnERC20.sol";


// 这个合约在这个项目里面只做展示，实际上本项目用的是这个合约的abi，本合约已经部署到sepolia了
// 0xDDB5973a919719E18Fe5a67e54CEA173a4c5111a
contract SimpleDelegateContract {
    event Executed(address indexed to, uint256 value, bytes data);
 
    struct Call {
        bytes data;
        address to;
        uint256 value;
    }
 
    function execute(Call[] memory calls) external payable {
        for (uint256 i = 0; i < calls.length; i++) {
            Call memory call = calls[i];
            (bool success, bytes memory result) = call.to.call{value: call.value}(call.data);
            require(success, string(result));
            emit Executed(call.to, call.value, call.data);
        }
    }

    receive() external payable {}


    event Log(string message);

    function initialize() external payable {
        emit Log('Hello, world!');
    }
    
    function ping() external {
        emit Log('Pong!');
    }

    event ApproveAndDeposit(address token, address tokenbank, uint256 amount);

    function approveAndDeposit(address token, address tokenbank, uint256 amount) external {
        IERC20(token).approve(tokenbank, amount);
        TokenBank(tokenbank).deposit(amount);
        emit ApproveAndDeposit(token, tokenbank, amount);
    }
}
 
