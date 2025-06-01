// // SPDX-License-Identifier: MIT
// pragma solidity ^0.6.12;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
// import "@openzeppelin/contracts/math/SafeMath.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// contract SimpleSushiFarm is Ownable {
//     using SafeMath for uint256;
//     using SafeERC20 for IERC20;

//     // SUSHI 代币合约
//     IERC20 public sushi;

//     // LP 代币合约
//     IERC20 public lpToken;

//     // 每个区块分发的 SUSHI 数量
//     uint256 public sushiPerBlock;

//     // 上次更新奖励的区块号
//     uint256 public lastRewardBlock;

//     // 每个 LP 代币对应的累计 SUSHI 奖励（扩大 1e12 倍以提高精度）
//     uint256 public accSushiPerShare;

//     // 用户信息
//     struct UserInfo {
//         uint256 amount;     // 用户质押的 LP 代币数量
//         uint256 rewardDebt; // 用户的奖励债务
//     }

//     mapping(address => UserInfo) public userInfo;

//     constructor(
//         IERC20 _sushi,
//         IERC20 _lpToken,
//         uint256 _sushiPerBlock
//     ) public {
//         sushi = _sushi;
//         lpToken = _lpToken;
//         sushiPerBlock = _sushiPerBlock;
//         lastRewardBlock = block.number;
//     }

//     // 更新奖励变量
//     function updatePool() public {
//         if (block.number <= lastRewardBlock) {
//             return;
//         }
//         uint256 lpSupply = lpToken.balanceOf(address(this));
//         if (lpSupply == 0) {
//             lastRewardBlock = block.number;
//             return;
//         }
//         uint256 blocks = block.number.sub(lastRewardBlock);
//         uint256 sushiReward = blocks.mul(sushiPerBlock);
//         accSushiPerShare = accSushiPerShare.add(sushiReward.mul(1e12).div(lpSupply));
//         lastRewardBlock = block.number;
//     }

//     // 存入 LP 代币
//     function deposit(uint256 _amount) public {
//         UserInfo storage user = userInfo[msg.sender];
//         updatePool();
//         if (user.amount > 0) {
//             uint256 pending = user.amount.mul(accSushiPerShare).div(1e12).sub(user.rewardDebt);
//             if (pending > 0) {
//                 sushi.safeTransfer(msg.sender, pending);
//             }
//         }
//         if (_amount > 0) {
//             lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
//             user.amount = user.amount.add(_amount);
//         }
//         user.rewardDebt = user.amount.mul(accSushiPerShare).div(1e12);
//     }

//     // 提取 LP 代币
//     function withdraw(uint256 _amount) public {
//         UserInfo storage user = userInfo[msg.sender];
//         require(user.amount >= _amount, "withdraw: not good");
//         updatePool();
//         uint256 pending = user.amount.mul(accSushiPerShare).div(1e12).sub(user.rewardDebt);
//         if (pending > 0) {
//             sushi.safeTransfer(msg.sender, pending);
//         }
//         if (_amount > 0) {
//             user.amount = user.amount.sub(_amount);
//             lpToken.safeTransfer(address(msg.sender), _amount);
//         }
//         user.rewardDebt = user.amount.mul(accSushiPerShare).div(1e12);
//     }
// }
