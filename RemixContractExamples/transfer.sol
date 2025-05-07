pragma solidity ^0.8.0;

contract AddressDataType {
    // wallet 
    address public wallet = 0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2;
	uint public myBalance = address(this).balance;

    constructor() payable {}

    function checkBalance() public view returns (uint) {
        // 
        return wallet.balance;
    }

    function sendEth(uint amount) public payable {
        //
        payable(wallet).transfer(amount);

    }
}
