// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 0.8.4之后才有revert
contract handleError {

    constructor() payable {}

    error MustEven(uint);
    function withdraw(uint amount) public {
        if (amount % 2 != 0) revert MustEven(amount);
        if (amount <= 100) revert('must more than 100!!');
        // payable(msg.sender).transfer(amount);
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Failed to send Ether");
    }

    function showBalance() public view returns(uint){
        return address(this).balance;
    }
}

interface IhandleError {
    function withdraw(uint amount) external ;
    function showBalance() external view returns(uint);
}

contract remoteCall {
    uint public withdrawBalance = 0;
    IhandleError public remoteContract;

    // 一开始要给一点钱，不然不够钱给gas
    constructor(address remoteAddr) payable {
        remoteContract = IhandleError(remoteAddr);
    }

    function showRemoteBalance() public view returns(uint) {
        return remoteContract.showBalance();
    }

    receive() external payable { }

    event errorInfo(string _info);
    function remoteWithdraw(uint amount) public payable 
        returns (bool succeed, string memory runInfo){

        try remoteContract.withdraw(amount) {
            withdrawBalance += amount;
            return (true, 'remote withdraw success');

        } catch Error(string memory info){
            emit errorInfo(info);
            return (false, info);

        } catch (bytes memory rawError) {
            emit errorInfo(string(rawError));
            return (false, string(rawError));
        }
    }

    function showBalance() public view returns(uint){
        return address(this).balance;
    }
}