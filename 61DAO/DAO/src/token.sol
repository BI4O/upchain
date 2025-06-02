pragma solidity ^0.8.20;

import "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    struct Checkpoint {
        uint32 fromBlock;
        uint96 votes;
    }

    // 检查点记录
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;
    mapping(address => uint32) public numCheckpoints;

    constructor() ERC20("VOTE","VT") {}
    function mint(address to, uint amount) public {
        _mint(to, amount);
        _writeCheckpoint(to, _safe96(balanceOf(to), "amount exceeds 96 bits"));
    }

    function _safe96(uint256 n, string memory errorMessage) internal pure returns (uint96) {
        require(n < 2**96, errorMessage);
        return uint96(n);
    }

    // 写入checkpoint
    function _writeCheckpoint(address account, uint96 newVotes) internal {
        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints > 0 && checkpoints[account][nCheckpoints - 1].fromBlock == block.number) {
            checkpoints[account][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[account][nCheckpoints] = Checkpoint(uint32(block.number), newVotes);
            numCheckpoints[account] = nCheckpoints + 1;
        }
    }

    // 重写_update，每次转账、mint、burn后为from和to写入checkpoint
    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        if (from != address(0)) {
            _writeCheckpoint(from, _safe96(balanceOf(from), "amount exceeds 96 bits"));
        }
        if (to != address(0)) {
            _writeCheckpoint(to, _safe96(balanceOf(to), "amount exceeds 96 bits"));
        }
    }

    // 查询指定区块的票数
    function getPriorVotes(address account, uint blockNumber) public view returns(uint96) {
        require(blockNumber < block.number, "not yet determined");
        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }
        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2;
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    // 查询当前票数
    function getCurrentVotes(address account) external view returns (uint96) {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }
}
