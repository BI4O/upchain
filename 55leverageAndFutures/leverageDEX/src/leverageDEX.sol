pragma solidity ^0.8.20;

import {IERC20} from "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";


contract USDCBase is ERC20 {
    constructor() ERC20("USDC","USDC") {}
    // 为了方便演练，谁都可以mint
    function mint(address to, uint amount) public {
        _mint(to, amount);
    } 
}

// 极简的杠杆 DEX 实现
contract SimpleLeverageDEX {

    uint public vK;  // 100000 
    uint public vETHAmount;
    uint public vUSDCAmount;

    USDCBase public USDC;  // 自己创建一个币来模拟 USDC

    struct PositionInfo {
        uint256 margin; // 保证金    // 真实的资金， 如 USDC 
        uint256 borrowed; // 借入的资金
        int256 position;    // 虚拟 eth 持仓
    }

    // 每个客户的持仓信息（虚拟了多少个eth）
    mapping(address => PositionInfo) public positions;

    constructor(uint vEth, uint vUSDC) {
        vETHAmount = vEth;
        vUSDCAmount = vUSDC;
        vK = vEth * vUSDC;
        USDC = new USDCBase();
    }


    // 开启杠杆头寸，保证金，倍数，多/空
    function openPosition(uint256 _margin, uint level, bool long) external {
        require(positions[msg.sender].position == 0, "Position already open");

        PositionInfo storage pos = positions[msg.sender] ;

        USDC.transferFrom(msg.sender, address(this), _margin); // 用户提供保证金
        uint amount = _margin * level;
        uint256 borrowAmount = amount - _margin;

        pos.margin = _margin;
        pos.borrowed = borrowAmount;

        // 计算头寸：相当于有多少个eth
        if (long) {
            pos.position = int256((vETHAmount * amount) / (vUSDCAmount + amount));
        } else {
            pos.position = -int256((vETHAmount * amount) / (vUSDCAmount + amount));
        }
    }

    // 关闭头寸并结算, 不考虑协议亏损
    function closePosition() external {
        PositionInfo memory pos = positions[msg.sender];
        require(pos.position != 0, "No open position");
        int256 usdcLeft = calculatePnL(msg.sender);
        
        // 盈亏不能为负，最少为0
        uint256 payout = usdcLeft > 0 ? uint256(usdcLeft) : 0;
        delete positions[msg.sender];
        require(USDC.transfer(msg.sender, payout), "Transfer failed");
    }

    // 清算头寸， 清算的逻辑和关闭头寸类似，不过利润由清算用户获取
    // 注意： 清算人不能是自己，同时设置一个清算条件，例如亏损大于保证金的 80%
    function liquidatePosition(address _user) external {
        PositionInfo memory position = positions[_user];
        require(msg.sender != _user, "Users can't self-liquidate");
        require(position.position != 0, "No open position");
        int256 usdcLeft = calculatePnL(_user);
        uint256 payout = usdcLeft > 0 ? uint256(usdcLeft) : 0;
        // 如果剩下的资金已经少于保证金的20%，就清算
        require(payout <= position.margin * 2 / 10, "Not lower than 20% margin!");
        delete positions[_user];
        require(USDC.transfer(msg.sender, payout), "Transfer failed");
    }

    // 计算盈亏： 对比当前的仓位和借的 vUSDC
    function calculatePnL(address user) public view returns (int256) {
        PositionInfo memory pos = positions[user];
        if (pos.position == 0) return 0;
        uint256 ethPrice = vUSDCAmount / vETHAmount;
        int256 value = pos.position * int256(ethPrice);
        int256 pnl = value - int256(pos.borrowed);
        return pnl;
    }

    // 仅测试用：模拟swap，改变池子中的USDC和ETH数量，影响价格，并返回最新ETH兑USDC价格
    function testSwapUSDCForETH(uint usdcIn) public returns (uint price) {
        require(usdcIn > 0, "usdcIn must be positive");
        uint ethOut = vETHAmount - (vK / (vUSDCAmount + usdcIn));
        vUSDCAmount += usdcIn;
        vETHAmount -= ethOut;
        price = vUSDCAmount / vETHAmount;
        return price;
    }
    function testSwapETHForUSDC(uint ethIn) public returns (uint price) {
        require(ethIn > 0, "ethIn must be positive");
        uint usdcOut = vUSDCAmount - (vK / (vETHAmount + ethIn));
        vETHAmount += ethIn;
        vUSDCAmount -= usdcOut;
        price = vUSDCAmount / vETHAmount;
        return price;
    }
}