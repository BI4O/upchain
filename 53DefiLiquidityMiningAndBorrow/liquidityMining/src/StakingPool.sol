pragma solidity ^0.8.20;

import {IStaking, IToken} from "./IStaking.sol";
import {ERC20} from "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract KKToken is ERC20, IToken {
    constructor() ERC20("KKToken","KK") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract kETH is ERC20, IToken {
    address public owner;
    constructor() ERC20("kEthereum","kETH") {
        owner = msg.sender;
    }
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "Must owner mint.");
        _mint(to, amount);
        _approve(to, owner, type(uint256).max); // 自动授权owner（StakingPool）无限额度
    }
    function burn(address from, uint256 amount) external {
        require(msg.sender == owner, "Must owner burn.");
        _burn(from, amount);
    }
}

contract StakingPool is IStaking {
    KKToken public kk;
    kETH public lp;

    uint public kkPerBlock;
    uint public lastRewardBlock;
    uint public acckkPerShare;
    uint public totalStaked;

    // 用户信息
    struct UserInfo {
        uint256 amount;     // 用户质押的eth代币数量
        uint256 rewardDebt; // 用户的奖励债务
    }
    // 用户表
    mapping(address => UserInfo) public userInfo;

    // 初始化
    constructor() {
        kk = new KKToken();
        lp = new kETH();
        
        kkPerBlock = 10;
        lastRewardBlock = block.number;
    }

    // 接受eth
    receive() payable external {}

    function updatePool() public {
        // 步骤1：如果当前区块小于等于上次结算区块，不需要更新
        if (block.number <= lastRewardBlock) {
            return;
        }
        // 步骤2：如果没有任何人质押，直接更新lastRewardBlock并返回
        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }
        // 步骤3：计算距离上次结算经过了多少区块
        uint blocks = block.number - lastRewardBlock;
        // 步骤4：计算这段时间内应发放的KK奖励总量
        uint kkReward = blocks * kkPerBlock;
        // 步骤5：mint KK Token 到合约本身，作为后续奖励池
        kk.mint(address(this), kkReward);
        // 步骤6：更新每一份ETH对应的累计奖励（扩大1e30倍精度）
        acckkPerShare += kkReward * 1e30 / totalStaked;
        // 步骤7：更新lastRewardBlock为当前区块
        lastRewardBlock = block.number;
    }

    /**
     * @dev 质押 ETH 到合约
     */
    function stake() payable external {
        UserInfo storage user = userInfo[msg.sender];
        // 步骤1：先更新全局池子的奖励状态
        updatePool();
        // 步骤2：如果用户之前已经有质押，先结算并发放上一次的KK奖励
        if (user.amount > 0) {
            uint pending = (user.amount * acckkPerShare / 1e30) - user.rewardDebt;
            if (pending > 0) {
                kk.transfer(msg.sender, pending);
            }
        }
        // 步骤3：如果本次有新质押，铸造等额LP Token并增加用户质押数量
        if (msg.value > 0) {
            lp.mint(msg.sender, msg.value);
            user.amount += msg.value;
            totalStaked += msg.value;
        }
        // 步骤4：更新用户的奖励债务，确保后续不会重复领取
        user.rewardDebt = user.amount * acckkPerShare / 1e30;
    }

    /**
     * @dev 赎回质押的 ETH
     * @param amount 赎回数量
     */
    function unstake(uint256 amount) external {
        UserInfo storage user = userInfo[msg.sender];
        // 步骤1：检查用户质押数量是否足够
        require(user.amount >= amount, "Withdraw eth exeed!");
        require(amount > 0, "Widraw amount must positive");
        // 步骤2：先更新全局池子的奖励状态
        updatePool();
        // 步骤3：结算并发放用户的KK奖励
        uint pending = (user.amount * acckkPerShare / 1e30) - user.rewardDebt;
        if (pending > 0) {
            kk.transfer(msg.sender, pending);
        }
        // 步骤4：扣除用户质押数量和总质押量
        user.amount -= amount;
        totalStaked -= amount;
        // 步骤5：回收并销毁等额LP Token
        lp.transferFrom(msg.sender, address(this), amount);
        lp.burn(address(this), amount);
        // 步骤6：返还等额ETH给用户
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");
        // 步骤7：更新用户的奖励债务
        user.rewardDebt = user.amount * acckkPerShare / 1e30;
    }

    /**
     * @dev 领取 KK Token 收益
     */
    function claim() external {
        UserInfo storage user = userInfo[msg.sender];
        // 步骤1：先更新全局池子的奖励状态
        updatePool();
        // 步骤2：计算并发放用户可领取的KK奖励
        uint pending = (user.amount * acckkPerShare / 1e30) - user.rewardDebt;
        if (pending > 0) {
            kk.transfer(msg.sender, pending);
        }
        // 步骤3：更新用户的奖励债务
        user.rewardDebt = user.amount * acckkPerShare / 1e30;
    }

    /**
     * @dev 获取质押的 ETH 数量
     * @param account 质押账户
     * @return 质押的 ETH 数量
     */
    function balanceOf(address account) external view returns (uint256) {
        UserInfo storage user = userInfo[account];
        return user.amount;
    }

    /**
     * @dev 获取待领取的 KK Token 收益
     * @param account 质押账户
     * @return 待领取的 KK Token 收益
     */
    function earned(address account) external view returns (uint256) {
        UserInfo storage user = userInfo[account];
        uint pending = (user.amount * acckkPerShare / 1e30) - user.rewardDebt;
        return pending;
    }
}