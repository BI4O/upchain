// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 public count;
    function get() public view returns(uint256) {return count;}
    function add(uint256 n) public {count += n;}
}

contract CounterProxy {
    uint public count;
    address public impl;
    function updateImpl(address newImpl) public {impl = newImpl;}
    
    // delegatecall会修改状态，所以不能用view修饰符
    function get() public returns(uint256) {
        require(impl != address(0), "Implementation not set");
        bytes memory pl = abi.encodeWithSignature("get()");
        (bool ok, bytes memory res) = impl.delegatecall(pl);
        require(ok, "get failed.");
        return abi.decode(res, (uint256));
    }
    
    function add(uint256 n) public {
        require(impl != address(0), "Implementation not set");
        bytes memory pl = abi.encodeWithSignature("add(uint256)", n);
        (bool ok,) = impl.delegatecall(pl);
        require(ok, "add failed.");
    }
    
    // 添加fallback函数处理所有未知函数调用
    fallback() external payable {
        require(impl != address(0), "Implementation not set");
        
        // 将所有调用委托给实现合约
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), sload(impl.slot), ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)
            
            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }
    
    // 添加receive函数处理纯ETH转账
    receive() external payable {}
}