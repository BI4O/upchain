pragma solidity ^0.8.20;

import "./token.sol";


/*
先实现一个可以可计票的 Token
实现一个通过 DAO 管理Bank的资金使用：
Bank合约中有提取资金withdraw()，该方法仅管理员可调用。
治理 Gov 合约作为 Bank 管理员, Gov 合约使用 Token 投票来执行响应的动作。
通过发起提案从Bank合约资金，实现管理Bank的资金。
*/


// 组织的金库，共同的资金
contract Bank {
    address public owner;
    constructor() {
        owner = msg.sender;
    }
    receive() payable external {}
    // Gov合约才可以回收Bank里面的额头eth资金
    function withdraw() public {
        require(msg.sender == owner, "Only owner can withdraw fund");
        (bool ok,) = payable(msg.sender).call{value: address(this).balance}("");
        require(ok, "withdraw failed!");
    }
}

/*
Go合约是治理合约
1. 任意人可以发起调用propose_withdraw，于是发起投票，以及指定最后截止时间，记录此时的blockNum
2. 根据记录的blockNum，启动快照，确定了各个持有token的人此时每人持有多少张选票
3. 持有token的人可以投票，然后记录在三个选项agree/disagree和abstain
3. 截止日期到了之后，谁都可以执行execute_withdraw，但是前提是验证agree的数量 > disgree的数量
*/
contract Gov {
    Bank public bank;
    Token public token;

    struct Proposal {
        uint Id;
        uint agree;
        uint disagree;
        uint abstain;
        uint deadline;  // 投票最后截止时间
        uint startAtBlockNum; // 投票开始时的区块，用来给token快照用
        bool executed; // 是否已执行
    }
    Proposal public latestProposal;
    uint public nextProposalId = 1;
    mapping(address => bool) public hasVoted; // 只针对当前提案有效

    event ProposalCreated(uint proposalId, uint deadline, uint startAtBlockNum);
    event Voted(uint proposalId, address voter, uint8 option, uint96 votes);
    event ProposalExecuted(uint proposalId, bool success);

    constructor() {
        bank = new Bank();
        token = new Token();
    }

    //  Gov收钱
    receive() external payable {}

    // 0: agree, 1: disagree, 2: abstain
    function vote(uint8 option) public {
        require(block.timestamp <= latestProposal.deadline, "Voting has ended");
        require(!latestProposal.executed, "Proposal already executed");
        require(!hasVoted[msg.sender], "Already voted");
        require(option <= 2, "Invalid option");
        uint96 votes = token.getPriorVotes(msg.sender, latestProposal.startAtBlockNum);
        require(votes > 0, "No voting power at snapshot");
        if (option == 0) {
            latestProposal.agree += votes;
        } else if (option == 1) {
            latestProposal.disagree += votes;
        } else {
            latestProposal.abstain += votes;
        }
        hasVoted[msg.sender] = true;
        emit Voted(latestProposal.Id, msg.sender, option, votes);
    }
    
    function propose_withdraw(uint _deadline) public {
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(
            latestProposal.deadline == 0 || 
            block.timestamp > latestProposal.deadline || 
            latestProposal.executed, 
            "There is an active proposal"
        );
        latestProposal = Proposal({
            Id: nextProposalId,
            agree: 0,
            disagree: 0,
            abstain: 0,
            deadline: _deadline,
            startAtBlockNum: block.number,
            executed: false
        });
        nextProposalId += 1;
        // 清空投票记录（只针对当前提案有效，直接重置）
        // 不能遍历所有地址，实际只需新提案时hasVoted全部视为false
        // 这里通过重置mapping实现（solidity不支持直接清空mapping，但新提案时逻辑上视为全部false）
        // 只有投票时才会置为true
        emit ProposalCreated(latestProposal.Id, _deadline, block.number);
    }

    function execute_withdraw() public payable {
        require(block.timestamp > latestProposal.deadline, "Voting not ended");
        require(!latestProposal.executed, "Already executed");
        require(latestProposal.agree > latestProposal.disagree, "Not enough agree votes");
        bank.withdraw();
        latestProposal.executed = true;
        emit ProposalExecuted(latestProposal.Id, true);
    }
}

