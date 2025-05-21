// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 使用可升级合约
import "@openzeppelin-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";

// 使用普通合约中的代理
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// 引入ERC20
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 逻辑合约
contract MyNFT_V1 is Initializable, ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    function initialize(string memory name, string memory symbol) public initializer {
        __ERC721_init(name, symbol);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function mint(address to, uint256 tokenId) external onlyOwner {
        _mint(to, tokenId);
    }

    /// @notice UUPS 升级权限控制，只允许合约拥有者
    function _authorizeUpgrade(address newImpl) internal override onlyOwner {}
}

// 代理合约
contract MyNFT_Proxy is ERC1967Proxy {
    constructor(address logic, bytes memory data) ERC1967Proxy(logic, data) {}
}

// 简单ERC20代币，所有人都可以mint
contract MyToken is ERC20 {
    constructor() ERC20("Mytoken", "MT") {}
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
