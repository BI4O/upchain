// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MyToken
 * @dev 支持 permit 的 ERC20 Token
 */
contract MyToken is ERC20, ERC20Permit {
    constructor() ERC20("MyToken", "MTK") ERC20Permit("MyToken") {
        _mint(msg.sender, 1_000_000 ether);
    }
}

/**
 * @title NFT
 * @dev 简单的 ERC721 NFT 合约，支持 mint
 */
contract NFT is ERC721 {
    using Strings for uint256;
    uint256 public nextTokenId = 1;

    constructor() ERC721("NFT", "T") {}

    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://base/";
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < nextTokenId && tokenId > 0, "tokenId not exists!");
        return string.concat(_baseURI(), tokenId.toString(), ".json");
    }

    function mint(address to) public {
        _safeMint(to, nextTokenId);
        nextTokenId++;
    }
}

/**
 * @title MerkleDistributor
 * @dev 只存 Merkle Root，提供白名单校验函数
 */
contract MerkleDistributor {
    bytes32 public immutable merkleRoot;

    constructor(bytes32 _merkleRoot) {
        merkleRoot = _merkleRoot;
    }

    /**
     * @dev 校验用户是否在白名单，amount 需与线下生成的 leaf 匹配
     */
    function isWhitelisted(address account, uint256 amount, bytes32[] calldata merkleProof) external view returns (bool) {
        bytes32 node = keccak256(abi.encodePacked(account, amount));
        return MerkleProof.verify(merkleProof, merkleRoot, node);
    }
}

/**
 * @title AirdopMerkleNFTMarket
 * @dev 支持白名单优惠价+permit授权+mint NFT 的市场合约
 */
contract AirdopMerkleNFTMarket {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    NFT public immutable nft;
    MerkleDistributor public immutable distributor;

    uint256 public constant WHITELIST_PRICE = 100 ether;
    uint256 public constant NORMAL_PRICE = 200 ether;

    // 记录每个用户的白名单资格和授权金额
    mapping(address => bool) public isWhitelistUser;
    mapping(address => uint256) public prePayAmount;

    event NFTClaimed(address indexed claimer, uint256 price, bool isWhitelist);
    event PermitPrePay(address indexed user, uint256 amount, bool isWhitelist);

    constructor(address _token, address _nft, address _distributor) {
        token = IERC20(_token);
        nft = NFT(_nft);
        distributor = MerkleDistributor(_distributor);
    }

    /**
     * @dev 用户先授权并校验资格
     * @param amount 用户希望授权的额度
     * @param merkleProof Merkle 证明
     * @param deadline permit 截止时间
     * @param v permit 签名参数v
     * @param r permit 签名参数r
     * @param s permit 签名参数s
     */
    function permitPrePay(
        uint256 amount,
        bytes32[] calldata merkleProof,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        address user = msg.sender;
        bool isWhitelist = distributor.isWhitelisted(user, WHITELIST_PRICE, merkleProof);
        uint256 minAmount = isWhitelist ? WHITELIST_PRICE : NORMAL_PRICE;
        require(amount >= minAmount, "permit amount too low for your qualification");

        // 调用permit授权
        MyToken(address(token)).permit(user, address(this), amount, deadline, v, r, s);

        // 记录资格和授权额度
        isWhitelistUser[user] = isWhitelist;
        prePayAmount[user] = amount;

        emit PermitPrePay(user, amount, isWhitelist);
    }

    /**
     * @dev 用户领取NFT，需先permitPrePay
     */
    function claimNFT() external {
        address claimer = msg.sender;
        bool isWhitelist = isWhitelistUser[claimer];
        uint256 price = isWhitelist ? WHITELIST_PRICE : NORMAL_PRICE;
        require(token.allowance(claimer, address(this)) >= price, "allowance not enough");
        require(prePayAmount[claimer] >= price, "prePay amount not enough");

        // 扣款
        token.safeTransferFrom(claimer, address(this), price);
        // mint NFT
        nft.mint(claimer);

        // 清理状态，防止重复claim
        delete isWhitelistUser[claimer];
        delete prePayAmount[claimer];

        emit NFTClaimed(claimer, price, isWhitelist);
    }

    /**
     * @dev 批量原子调用本合约的多个函数
     * @param data 每个函数的calldata数组
     */
    function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "multicall: subcall failed");
            results[i] = result;
        }
    }
}