pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenBank {
    IERC20 public immutable token;
    mapping(address => uint256) public balanceOf;
    
    // 链表头
    address constant HEAD = address(1);
    // 链表指针
    mapping(address => address) public nextUser;
    uint public listSize;

    constructor(address tokenAddr) {
        token = IERC20(tokenAddr);
        // 初始化链表
        nextUser[HEAD] = HEAD;
        listSize = 0;
    }

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    function _verifyIndex(address prev, uint256 newValue, address next) internal view returns(bool) {
        bool leftOk = prev == HEAD || balanceOf[prev] >= newValue;
        bool rightOk = next == HEAD || newValue >= balanceOf[next];
        return leftOk && rightOk;
    }

    function deposit(uint256 amount, address fromWhom, address toWhom) external {
        require(amount > 0, "Amount must be greater than 0");
        require(token.balanceOf(msg.sender) >= amount, "Insufficient token balance");
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");
        
        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        uint256 newBalance = balanceOf[msg.sender] + amount;
        balanceOf[msg.sender] = newBalance;
        
        // 链表操作
        if (nextUser[msg.sender] == address(0)) {
            // 新用户加入链表
            require(nextUser[toWhom] != address(0), "Invalid position");
            require(_verifyIndex(toWhom, newBalance, nextUser[toWhom]), "Not ordered");
            
            nextUser[msg.sender] = nextUser[toWhom];
            nextUser[toWhom] = msg.sender;
            listSize += 1;
        } else {
            // 更新已有用户在链表中的位置
            require(nextUser[fromWhom] == msg.sender, "Invalid from position");
            
            if (fromWhom == toWhom) {
                require(_verifyIndex(fromWhom, newBalance, nextUser[msg.sender]), "Not ordered");
            } else {
                // 移除旧位置
                nextUser[fromWhom] = nextUser[msg.sender];
                
                // 添加到新位置
                require(_verifyIndex(toWhom, newBalance, nextUser[toWhom]), "Not ordered");
                nextUser[msg.sender] = nextUser[toWhom];
                nextUser[toWhom] = msg.sender;
            }
        }
        
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount, address fromWhom, address toWhom) external {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        uint256 newBalance = balanceOf[msg.sender] - amount;
        balanceOf[msg.sender] = newBalance;
        
        // 链表操作
        require(nextUser[fromWhom] == msg.sender, "Invalid from position");
        
        if (newBalance == 0) {
            // 如果余额变为0，从链表中移除
            nextUser[fromWhom] = nextUser[msg.sender];
            nextUser[msg.sender] = address(0);
            listSize -= 1;
        } else if (fromWhom != toWhom) {
            // 更新用户在链表中的位置
            // 移除旧位置
            nextUser[fromWhom] = nextUser[msg.sender];
            
            // 添加到新位置
            require(toWhom != address(0), "Invalid to position");
            require(_verifyIndex(toWhom, newBalance, nextUser[toWhom]), "Not ordered");
            nextUser[msg.sender] = nextUser[toWhom];
            nextUser[toWhom] = msg.sender;
        } else {
            // 位置不变，只需验证是否仍然有序
            require(_verifyIndex(fromWhom, newBalance, nextUser[msg.sender]), "Not ordered");
        }
        
        bool success = token.transfer(msg.sender, amount);
        require(success, "Transfer failed");
        
        emit Withdraw(msg.sender, amount);
    }
    
    function getTopDepositors(uint k) external view returns(address[] memory) {
        require(k <= listSize, "Not enough depositors");
        address[] memory topUsers = new address[](k);
        address currAddr = nextUser[HEAD];
        for (uint i=0; i < k; i++) {
            topUsers[i] = currAddr;
            currAddr = nextUser[currAddr];
        }
        return topUsers;
    }

    function getContractBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
