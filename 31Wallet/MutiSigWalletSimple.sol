// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract MutiSigWalletSimple {
    address[] public owners;   // 签名者
    mapping(address => bool) public isOwner;  // 是否签名者
    uint public required = 2;  // 通过票数

    // 交易
    struct Tx {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint confirmations; //  同意的数量
    }

    // 根据id找到交易对象
    Tx[] public txLine; // 交易队列
    // 提议id
    uint public _nextTxId = 0; 
    // 根据id找到owner是否已经批准
    mapping(uint => mapping(address => bool)) public isApproved; //

    constructor(address _o1, address _o2, address _o3) {
        // register all owners
        owners = [_o1, _o2, _o3];
        required = 2;
        // set owner idendifier
        for (uint256 index = 0; index < owners.length; index++) {
            isOwner[owners[index]] = true;
        }
    }

    receive() external payable {}

    // 提交提案
    function submitTx(address _to, uint _value, bytes calldata _data) external {
        // 必须是owners之一才可以发起
        require(isOwner[msg.sender], "Must submit by one of owners!");
        // 加入提议
        txLine.push(
            Tx({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                confirmations: 0
            })
        );  
        // 记录提议者对提案的准许
        txLine[_nextTxId].confirmations += 1;
        isApproved[_nextTxId][msg.sender] = true;
        // 第一个tx是0，后面是逐步递增，刚好根据id获取
        _nextTxId += 1;
    }

    // 同意提案
    function approveTx(uint _txId) public {
        require(_txId < _nextTxId, "Tx not exists!");
        require(isOwner[msg.sender], "You are not one of owners");
        require(isApproved[_txId][msg.sender] == false, "You already approved this tx");

        // 记录谁准许了
        isApproved[_txId][msg.sender] = true;
        // 记录提案准许+1
        txLine[_txId].confirmations += 1;
    }

    // 执行提案
    function executeTx(uint _txId) public {
        // 所有人都可以执行
        require(_txId < _nextTxId, "Tx not exists!");
        Tx storage etx = txLine[_txId];
        require(etx.confirmations >= required, "Tx not enough comfirmations!");
        require(etx.executed != true, "Tx already excuted!");

        // 正式执行
        (bool ok,) = etx.to.call{value: etx.value}(etx.data);
        require(ok, "Tx failed when excuted!");
        etx.executed = true;
    }
}