// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 使用可升级合约
import "@openzeppelin-upgradeable/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin-upgradeable/contracts/access/OwnableUpgradeable.sol";
import "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

// 使用普通合约中的代理
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// 使用NFT和ERC20相关库
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// 逻辑合约V1
contract NFTMarket_V1 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    
    // 存储变量
    IERC20 public token;
    IERC721 public nft;

    // 账本1: 价格表
    mapping(uint => uint) public priceOfNFT;
    // 账本2: 作者
    mapping(uint => address) public sellerOfNFT;

    // 事件
    event NftListed(address indexed seller, uint indexed _NftId, uint price);
    event NftSold(address indexed buyer, uint indexed _NftId, uint price);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // 初始化函数，替代构造函数
    function initialize(address _ERC20, address _NFT) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        token = IERC20(_ERC20);
        nft = IERC721(_NFT);
    }

    // 支持nft主人上架自己的nft，委托给市场方{from: owner}
    function list(uint _NftId, uint _price) public {
        // 1. 确认：售卖人是作者，售价大于0
        require(nft.ownerOf(_NftId) == msg.sender && _price > 0, "U must owner and price should > 0");

        // 2. 转移
        nft.safeTransferFrom(msg.sender, address(this), _NftId);

        // 3. 记账
        sellerOfNFT[_NftId] = msg.sender;
        priceOfNFT[_NftId] = _price;

        // 广播
        emit NftListed(msg.sender, _NftId, _price);
    }

    function buyNFT(uint _NftId) public {
        address buyer = msg.sender;
        address seller = sellerOfNFT[_NftId];
        uint price = priceOfNFT[_NftId];

        // 1. 确认作品还在，购买者够钱
        require(seller != address(0),"NFT is not for sale");
        require(token.balanceOf(buyer) >= price, "You need more ERC20token!");

        // 2. 转移
        token.safeTransferFrom(buyer, seller, price);
        nft.safeTransferFrom(address(this), buyer, _NftId);

        // 3. 记账
        delete sellerOfNFT[_NftId];
        delete priceOfNFT[_NftId];

        // 广播
        emit NftSold(buyer, _NftId, price);
    }

    // UUPS升级权限控制
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // 支持safeTransferFrom
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

// 逻辑合约V2，支持EIP-712签名上架
contract NFTMarket_V2 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    IERC20 public token;
    IERC721 public nft;

    mapping(uint => uint) public priceOfNFT;
    mapping(uint => address) public sellerOfNFT;

    event NftListed(address indexed seller, uint indexed _NftId, uint price);
    event NftSold(address indexed buyer, uint indexed _NftId, uint price);

    bytes32 public constant LIST_TYPEHASH = keccak256("List(uint256 tokenId,uint256 price)");
    bytes32 public DOMAIN_SEPARATOR;

    struct List {
        uint256 tokenId;
        uint256 price;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _ERC20, address _NFT) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        token = IERC20(_ERC20);
        nft = IERC721(_NFT);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("NFTMarket_V2")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function permitList(
        address owner,
        List calldata listing,
        bytes calldata signature
    ) external {
        // EIP-712校验
        bytes32 structHash = keccak256(abi.encode(LIST_TYPEHASH, listing.tokenId, listing.price));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = digest.recover(signature);
        require(signer == owner, "Invalid signature");

        // 3. 校验owner是NFT拥有者
        require(nft.ownerOf(listing.tokenId) == owner, "Not NFT owner");

        // 4. 校验已授权
        require(nft.isApprovedForAll(owner, address(this)), "Not approved for all");

        // 5. 转NFT到市场合约
        nft.safeTransferFrom(owner, address(this), listing.tokenId);

        // 6. 记账
        sellerOfNFT[listing.tokenId] = owner;
        priceOfNFT[listing.tokenId] = listing.price;

        emit NftListed(owner, listing.tokenId, listing.price);
    }

    function buyNFT(uint _NftId) public {
        address buyer = msg.sender;
        address seller = sellerOfNFT[_NftId];
        uint price = priceOfNFT[_NftId];

        require(seller != address(0),"NFT is not for sale");
        require(token.balanceOf(buyer) >= price, "You need more ERC20token!");

        token.safeTransferFrom(buyer, seller, price);
        nft.safeTransferFrom(address(this), buyer, _NftId);

        delete sellerOfNFT[_NftId];
        delete priceOfNFT[_NftId];

        emit NftSold(buyer, _NftId, price);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // 支持safeTransferFrom
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

// 代理合约
contract NFTMarket_Proxy is ERC1967Proxy {
    constructor(address logic, bytes memory data) ERC1967Proxy(logic, data) {}
}