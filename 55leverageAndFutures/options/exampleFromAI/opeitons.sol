// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CallOption is ERC20, Ownable, ReentrancyGuard {
    struct OptionConfig {
        uint256 strikePrice;      // 行权价格（单位：wei）
        uint256 expirationDate;   // 到期时间戳
        uint256 totalSupply;      // 总发行量
        address underlyingAsset;  // 标的资产地址
        address usdtPair;         // 可选：USDT交易对地址
    }

    OptionConfig public currentOption;
    mapping(uint256 => OptionConfig) public historicalOptions;

    event OptionIssued(uint256 indexed optionId, uint256 amount);
    event OptionExercised(address indexed user, uint256 amount);
    event OptionExpired(uint256 indexed optionId);

    constructor() ERC20("CallOptionToken", "COPT") {}

    // 创建新期权合约（项目方权限）
    function createOption(
        uint256 _strikePrice,
        uint256 _expirationDate,
        address _underlyingAsset,
        uint256 _initialSupply
    ) external onlyOwner {
        require(block.timestamp < _expirationDate, "Invalid expiration date");
        require(_underlyingAsset != address(0), "Invalid asset address");

        currentOption = OptionConfig({
            strikePrice: _strikePrice,
            expirationDate: _expirationDate,
            totalSupply: _initialSupply,
            underlyingAsset: _underlyingAsset,
            usdtPair: address(0)
        });

        _mint(msg.sender, _initialSupply);
        historicalOptions[optionId] = currentOption;
    }

    // 发行期权代币（项目方操作）
    function mintOptions(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // 用户行权（需支付行权价差额）
    function exercise(uint256 amount) external nonReentrant {
        require(block.timestamp <= currentOption.expirationDate, "Option expired");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        uint256 totalCost = amount * currentOption.strikePrice;
        IERC20(currentOption.underlyingAsset).transferFrom(
            msg.sender,
            address(this),
            totalCost
        );

        _burn(msg.sender, amount);
        emit OptionExercised(msg.sender, amount);
    }

    // 过期自动销毁（需项目方触发）
    function expireOption() external onlyOwner {
        require(block.timestamp > currentOption.expirationDate, "Not expired");
        require(currentOption.underlyingAsset != address(0), "No asset to redeem");

        uint256 totalSupply = balanceOf(address(this));
        IERC20(currentOption.underlyingAsset).transfer(
            owner(),
            totalSupply * currentOption.strikePrice
        );

        selfdestruct(payable(owner())); // 安全销毁合约
    }

    // 可选：创建USDT交易对（需外部DEX集成）
    // function createUSDTPair(address usdtToken) external onlyOwner {
    //     currentOption.usdtPair = usdtToken;
    //     // 此处可集成Uniswap V2的addLiquidity逻辑
    // }

    // 安全增强：防止超额行权
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20) {
        super._beforeTokenTransfer(from, to, amount);
        require(block.timestamp <= currentOption.expirationDate, "Trading closed");
    }
}