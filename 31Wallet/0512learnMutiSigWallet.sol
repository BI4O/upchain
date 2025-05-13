// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title 多签钱包（MultiSigWallet）
 * @dev 三个拥有者中至少两人同意方可执行交易
 */
contract MultiSigWallet {
    // 事件声明
    event Deposit(address indexed sender, uint amount);                            // 存款事件
    event SubmitTransaction(uint indexed txId, address indexed to, uint value, bytes data); // 提交交易事件
    event ApproveTransaction(address indexed owner, uint indexed txId);           // 批准交易事件
    event ExecuteTransaction(uint indexed txId);                                  // 执行交易事件
    event RevokeApproval(address indexed owner, uint indexed txId);               // 撤销批准事件

    // 多签钱包的拥有者列表及权限映射
    address[] public owners;               // 存储所有拥有者地址
    mapping(address => bool) public isOwner; // 快速判断地址是否为拥有者
    uint public required;                  // 执行交易所需的最小批准数量

    // 交易结构体定义
    struct Transaction {
        address to;       // 接收地址
        uint value;       // 转账金额
        bytes data;       // 可选调用数据
        bool executed;    // 是否已执行
        uint confirmations; // 已确认数量
    }

    Transaction[] public transactions;                         // 存储所有交易提案
    mapping(uint => mapping(address => bool)) public approved; // txId => (owner => 是否已批准)

    // 修饰符定义
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner"); // 仅拥有者可调用
        _;
    }

    modifier txExists(uint _txId) {
        require(_txId < transactions.length, "Tx does not exist"); // 交易必须存在
        _;
    }

    modifier notExecuted(uint _txId) {
        require(!transactions[_txId].executed, "Tx already executed"); // 交易未执行
        _;
    }

    modifier notApproved(uint _txId) {
        require(!approved[_txId][msg.sender], "Tx already approved"); // 调用者未批准过此交易
        _;
    }

    /**
     * @dev 构造函数，初始化三个拥有者，并设置批准阈值为2
     * @param _owner1 拥有者1地址
     * @param _owner2 拥有者2地址
     * @param _owner3 拥有者3地址
     */
    constructor(address _owner1, address _owner2, address _owner3) {
        owners = [_owner1, _owner2, _owner3];
        required = 2;
        for (uint i = 0; i < owners.length; i++) {
            isOwner[owners[i]] = true;
        }
    }

    /**
     * @dev 接收以太币（直接转账到合约）
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev 提交一笔新的交易提案
     * @param _to 接收地址
     * @param _value 转账金额
     * @param _data 调用数据（可选）
     */
    function submitTransaction(address _to, uint _value, bytes calldata _data)
        external
        onlyOwner
    {
        uint txId = transactions.length;
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                confirmations: 0
            })
        );
        emit SubmitTransaction(txId, _to, _value, _data);
    }

    /**
     * @dev 拥有者批准一笔交易提案
     * @param _txId 交易ID
     */
    function approveTransaction(uint _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
        notApproved(_txId)
    {
        approved[_txId][msg.sender] = true;
        transactions[_txId].confirmations += 1;
        emit ApproveTransaction(msg.sender, _txId);
    }

    /**
     * @dev 执行已获得足够批准的交易
     * @param _txId 交易ID
     */
    function executeTransaction(uint _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
    {
        Transaction storage txn = transactions[_txId];
        require(txn.confirmations >= required, "Not enough approvals"); // 检查批准数

        txn.executed = true;
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Tx failed");

        emit ExecuteTransaction(_txId);
    }

    /**
     * @dev 拥有者撤销对未执行交易的批准
     * @param _txId 交易ID
     */
    function revokeApproval(uint _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
    {
        require(approved[_txId][msg.sender], "Tx not approved");
        approved[_txId][msg.sender] = false;
        transactions[_txId].confirmations -= 1;
        emit RevokeApproval(msg.sender, _txId);
    }

    /**
     * @dev 获取所有拥有者地址
     * @return 拥有者地址数组
     */
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    /**
     * @dev 获取交易提案总数
     * @return 交易数量
     */
    function getTransactionCount() external view returns (uint) {
        return transactions.length;
    }

    /**
     * @dev 获取指定交易的详细信息
     * @param _txId 交易ID
     * @return to 接收地址
     * @return value 转账金额
     * @return data 调用数据
     * @return executed 是否已执行
     * @return confirmations 已批准数量
     */
    function getTransaction(uint _txId)
        external
        view
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint confirmations
        )
    {
        Transaction storage txn = transactions[_txId];
        return (txn.to, txn.value, txn.data, txn.executed, txn.confirmations);
    }
}
