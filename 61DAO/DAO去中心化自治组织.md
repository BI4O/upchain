# DAO 治理

### DAO

**D**ecentralized **A**utonomous **O**rganization 去中心化自治组织

- MakerDAO（现SKY）
- The Optimism Collective
- CityDAO

围绕一个共同的目标而组成的团体

### DAO治理内容

- 资金分配
- 参数调节
- Bug修复
- 系统升级
- 发展方向

### 治理过程

##### 一、公示期 Proposal Create

- 比如2天，大家可以看到要决议的内容
- 在比如snapshot.box上面发提案
- 一般有一个模板说明背景、目的、预算等

##### 二、投票期 Voting Active

- 比如2天，大家可以根据自己手上的选票来投票
- 比如质押代币来做投票（但是这样可能大家不愿意）
- 比如使用token快照来做投票

> 为什么是快照：因为怕有的人用100token投完票之后转给下一个人，下一个人又用者100个token来行使投票权。**质押**虽然可以解决重复投但是有损大家的利益，因为这段时间就不能自由交易token了

##### 三、验票

- 通常很快就能得到投票结果，结果是执行或是拒绝

##### 四、执行期

- 如果决议通过，那么就进入执行期，比如2天
- 链上提案：用TimeLock合约或者Governor合约自动执行
- 链下提案：管理员或者多期签钱包执行

> 执行本来是一个几乎瞬间就可以完成的事情，但是在这个比如2天的时间里，用户觉得决议结果对自己不利的，可以在这段时间内按旧的规则退出，然后执行就不会对那些用户产生负面的影响

### 链下治理 - 快照

- 链下快照所有用户在每个区块高度的余额，比如用viem来扫块

- 用户链下签名投票，确认每一个用户的投票权

### 链上治理 - 提案

- 执行合约的函数，比如调用uniswap的setFee开关，收取所有交易手续费的1/6归基金会

### 链上治理 - 投票

为了防止用户以token做选票的时候，投完了给比尔呢转，然后别人又用同一些token来造成二次投票的情况，需要做一些额外的存储

比如说，每一次transfer和transferFrom的时候，都要记录一下数据，检查一下每个账号，从0～n笔交易，交易完成时的余额和区块高度各是多少

##### 比如compound的代币 [COMP](https://github.com/compound-finance/compound-protocol/blob/master/contracts/Governance/Comp.sol)

```solidity
// compound代币

// 检查点
struct Checkpoint {
	uint32 fromBlock; // 交易完成的那个区块高度
	uint96 votes;  // 交易完成时的余额，其实就是剩下的票
}

// 每个地址对应的每一次转账序号的检查点信息
// checkpoints[addr1][12] 记录了addr1的第12次转账的检查点信息
mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

// 每个检查点已经转账了多少次（有多少个检查点）
// numCheckpoints[addr1] = 123 表示目前addr1一共做了123次转账
mapping(address => uint32) public numCheckpoints;

// 二分法查找给定的区块高度下，这个用户的余额（票数）有多少
function getPriorVotes(address account, uint blockNumber) public view returns(uint96) {...}

// 计算当前高度下这个用户已经交易的次数
function getCurrentVotes(address account) external view returns (uint96) {
    uint32 nCheckpoints = numCheckpoints[account];
    return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
}
```



