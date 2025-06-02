// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract CallOption is ERC20, Ownable, ReentrancyGuard {
    struct OptionConfig {
        uint256 strikePrice;      // 行权价格（单位：wei）
        uint256 expirationDate;   // 到期时间戳
        uint256 totalSupply;      // 总发行量
        address underlyingAsset;  // 标的资产地址
        address strikeAsset;      // 行权支付资产（如USDT）
    }

    OptionConfig public currentOption; // 当前期权配置
    bool public optionCreated;         // 是否已创建期权
    bool public optionExpired;         // 是否已过期

    event OptionIssued(uint256 amount);        // 发行期权事件
    event OptionExercised(address indexed user, uint256 amount); // 行权事件
    event OptionExpired();                     // 期权过期事件

    constructor() ERC20("CallOptionToken", "COPT") Ownable(msg.sender) {} // 构造函数，初始化ERC20

    // 创建新期权合约（仅项目方）
    function createOption(
        uint256 _strikePrice,
        uint256 _expirationDate,
        address _underlyingAsset,
        address _strikeAsset,
        uint256 _initialSupply
    ) external onlyOwner {
        require(!optionCreated, "Option already created"); // 只能创建一次
        require(block.timestamp < _expirationDate, "Invalid expiration date"); // 到期日需在未来
        require(_underlyingAsset != address(0), "Invalid asset address"); // 标的资产地址有效
        require(_strikeAsset != address(0), "Invalid strike asset"); // 行权资产地址有效
        require(_initialSupply > 0, "Initial supply must be positive"); // 发行量大于0

        // 项目方需提前授权合约转入足额标的资产
        uint256 totalUnderlying = _initialSupply;
        require(
            IERC20(_underlyingAsset).transferFrom(msg.sender, address(this), totalUnderlying),
            "Underlying asset transfer failed"
        );

        currentOption = OptionConfig({
            strikePrice: _strikePrice,
            expirationDate: _expirationDate,
            totalSupply: _initialSupply,
            underlyingAsset: _underlyingAsset,
            strikeAsset: _strikeAsset
        });
        optionCreated = true; // 标记已创建
        _mint(msg.sender, _initialSupply); // 给项目方铸造期权Token
        emit OptionIssued(_initialSupply);
    }

    // 用户行权（支付行权价，获得标的资产）
    function exercise(uint256 amount) external nonReentrant {
        require(optionCreated, "Option not created"); // 必须已创建
        require(!optionExpired, "Option expired"); // 未过期
        require(block.timestamp <= currentOption.expirationDate, "Option expired"); // 未到期
        require(balanceOf(msg.sender) >= amount, "Insufficient option balance"); // 用户有足够期权Token
        require(amount > 0, "Amount must be positive"); // 行权数量大于0

        uint256 totalStrike = amount * currentOption.strikePrice / 1e18;
        // 用户支付行权价（如USDT）给项目方
        require(
            IERC20(currentOption.strikeAsset).transferFrom(msg.sender, owner(), totalStrike),
            "Strike asset transfer failed"
        );
        // 合约转出标的资产给用户
        require(
            IERC20(currentOption.underlyingAsset).transfer(msg.sender, amount),
            "Underlying asset transfer failed"
        );
        _burn(msg.sender, amount); // 销毁用户行权的期权Token
        emit OptionExercised(msg.sender, amount);
    }

    // 过期销毁（项目方赎回剩余标的资产）
    function expireOption() external onlyOwner {
        require(optionCreated, "Option not created"); // 必须已创建
        require(!optionExpired, "Already expired"); // 只能过期一次
        require(block.timestamp > currentOption.expirationDate, "Not expired yet"); // 必须到期后
        optionExpired = true; // 标记已过期
        uint256 remaining = IERC20(currentOption.underlyingAsset).balanceOf(address(this)); // 查询剩余标的
        if (remaining > 0) {
            IERC20(currentOption.underlyingAsset).transfer(owner(), remaining); // 返还剩余标的资产
        }
        emit OptionExpired();
    }

    function _update(address from, address to, uint256 amount) internal override {
        require(optionCreated, "Option not created"); // 必须已创建
        require(block.timestamp <= currentOption.expirationDate, "Trading closed"); // 到期后禁止转账
        super._update(from, to, amount); // 调用父合约的_update实现
    }
} 