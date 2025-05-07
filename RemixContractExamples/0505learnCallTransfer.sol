pragma solidity ^0.8.0;

contract Caller_ {
    function sendEther(address to, uint256 value) public returns (bool) {
        // 使用 call 发送 ether
        bytes memory playload = abi.encodeWithSignature("sendEther()");
        (bool success,) = to.call{value: value}(playload);
        require(success, "sendEther failed");
        return success;
    }

    receive() external payable {}
}

contract Callee {
    uint256 value;

    function getValue() public view returns (uint256) {
        return value;
    }

    function setValue(uint256 value_) public payable {
        require(msg.value > 0);
        value = value_;
    }
}

contract Caller {
    function callSetValue(address callee, uint256 value) public returns (bool) {
        // call setValue()
        bytes memory playload = abi.encodeWithSignature("setValue(uint)", value);
        (bool success,) = callee.call{value: 1 ether}(playload);
        require(success, "call function failed");
        return success;
    }
}
