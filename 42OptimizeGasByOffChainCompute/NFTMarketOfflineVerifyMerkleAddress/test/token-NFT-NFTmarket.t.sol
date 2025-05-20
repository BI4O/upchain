// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "src/token-NFT-NFTmarket.sol";
import "lib/openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";

contract TokenNFTMarketTest is Test {
    MyToken token;
    NFT nft;
    MerkleDistributor distributor;
    AirdopMerkleNFTMarket market;

    // --- 白名单与proof（与TS脚本保持一致） ---
    address[] whitelist = [
        0x2a592D529621404fF66e7cB0A1d5fc21E6F3E12A,
        0xCa4e8164bb60560962240323F7708e41437dE278,
        0x4eb6a33ABF1d7ad79A8bbDb3Cc5e504A803E9210,
        0xC2846FED2B965EF838f93B654D9C9b8B0070CdD2,
        0xD8733236aB135F7CC22b2b0Ec544C5d65e94E0e0,
        0x97c32a259607c611Ae2f461cd0065290fa503ab3,
        0x32B365BD3896e09cb2322F0F4FE93b758b76FdD0,
        0x4dB4c476d8602Ed7717A55140999580FF6ec747b,
        0xA6142Fa41F59862D6e46b6BA9B8F48417bFbFa22,
        0x9CA80fC050e76E1aD4482783bA5626cac8dDf962
    ];
    uint256[] whitelistAmounts = [
        100 ether, 100 ether, 100 ether, 100 ether, 100 ether,
        100 ether, 100 ether, 100 ether, 100 ether, 100 ether
    ];
    // 这里proofs需要你用TS脚本生成后填入
    bytes32[][] public whitelistProofs;

    // 这里假设merkleRoot已由TS脚本生成，手动填入
    bytes32 merkleRoot = 0x68cff4ae3124517f9991180d2edcc87fbb5cbf3a206dd2fd7ac72a3448adfe81;

    // 随机生成10个非白名单地址（使用简单数字避免校验和问题）
    address[] nonWhitelist = [
        0x0c9Ae8a1f39e508bD72F34e0FDDf6BDa4bf5a2A3,
        0xB5c49A3Dd28E517C1F9FCdc5E3214408879ce310,
        0xb3B8a188a34DaEC01C242A11fc01f53F0B533De7,
        0x8bbFe6bF08d33D7b83d87DD649493790b0f50581,
        0x3C6edd0c454B7DfA0563762A0a44645624535Be5,
        0x592612Dc91a5d20e4598A7580b379c29F65D746a,
        0x3f6d876c23DFee0f04034724a67eFa447F71800C,
        0x6C26b847D8d3C1039cf5C4d44f89bc49bff5AfEB,
        0xb6627Ea208719d2176f154f33aa318E00E310a6D,
        0xC91A4BA805B11d17db0D526694E0E824D50c3057
    ];

    // --- 地址对应私钥 ---
    uint256 sk0 = 0x49442aaac1426ab3bb07790a95d0d27ef5cc9ddd7719750ae1f1f0847ce9e996;
    uint256 sk1 = 0x8bcec3f0513f0628b5f3e2fa7946af3337e0470046111cc487fea17f2ea0094c;
    uint256 sk2 = 0x3d5ef709d3b14e5efbee0f674ee2917483c28acbd93cdbb6d3145fd1f756a3af;
    uint256 sk3 = 0x7e77c1bb5b21efbe039deceb58f54a5e46a2d5b06ad8374882e80fc10190d0f5;
    uint256 sk4 = 0x6dc5dc2ad50d5b7dc115d62afffc9b9fea21a8c0e04a23f56491e96a1ad20777;
    uint256 sk5 = 0xbb0d149682b62ea1ccd794e5979a3658d68f1859941df940c7fa38e6bc80d103;
    uint256 sk6 = 0xec32e360b69bd75a4ac0e38cc03678c8c8dc2f6fdcec28892978b40eeb4a62b2;
    uint256 sk7 = 0x22b6b20caf9925a266e10076963bca9824196700e7d1a6443f10ebdf781a3628;
    uint256 sk8 = 0xc4c6dc26ba1213334044c73ffeaaa28a83f0d7331411169044b5e035cb542a4d;
    uint256 sk9 = 0x995c21ed8d1b37d4a4240d2fb2c621b0556e945c66dc00d635be7c0e26767718;
    uint256 nsk0 = 0x1f5e0a1aaad072eec51b9471d21a790bd1556bdcfb2d2516468479a4d87d49a0;
    uint256 nsk1 = 0x666fc4567b07589beaa619c0d5fe18b83c33b6422c7417595c56dda027db18a7;
    uint256 nsk2 = 0xb9af782a2b2bd0152b50acf586dd02e179b01995b761eab7a02cdfacb5a80b78;
    uint256 nsk3 = 0x5ce30cec80bc7c28994196b362ed50c939c418761432371d156fd88d4a7b2c21;
    uint256 nsk4 = 0xf0be66d3abc226294c28c0bbfc9929cc9e5c5d4328e5d2f8546b006e46dec248;
    uint256 nsk5 = 0xd7cb9157916c5a8195b2d0c3b8e31ebf07e309be5aff3354e03d433601b8ef79;
    uint256 nsk6 = 0x0ca2cddfe0277dc910fa5f9a76e2d205bec9af77b3e5b24cb4aa3606b2de7bde;
    uint256 nsk7 = 0x8f6cb968a524f6719d619f18af867835aeca7caaab03b978b91ad8c1e13c4790;
    uint256 nsk8 = 0xc392337b6d03110692a8335e902feadacabc631a43595882afa08264348780d6;
    uint256 nsk9 = 0xf871e1c11926c48f5c2148cc0c5dd713757be87c8e5e10558087e1e60bb91d67;

    // --- EIP-2612 Permit Typehash ---
    bytes32 constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        // 1. 部署合约
        token = new MyToken();
        nft = new NFT();
        distributor = new MerkleDistributor(merkleRoot);
        market = new AirdopMerkleNFTMarket(address(token), address(nft), address(distributor));
        
        // 2. 初始化白名单证明
        bytes32[] memory proof0 = new bytes32[](4);
        proof0[0] = 0xe526a6bc5a355a80291939ec007d0a1bf3ee52af1f6056246ec581df24aa6beb;
        proof0[1] = 0xb8720419c860603804ca273e72d5f6cec47b05c3e9bdb13c4ca8ac23d9d7f690;
        proof0[2] = 0x5439ffff97f42406d94bc69d63f6756d87f3e0d3b2f24e60ccf4a9337c0ebb7b;
        proof0[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof0);
        
        bytes32[] memory proof1 = new bytes32[](4);
        proof1[0] = 0x0b5a91ba3fc46350addf2efa0cf0af2ad293a5f40f84aac97f3ab91b20f5708c;
        proof1[1] = 0xb8720419c860603804ca273e72d5f6cec47b05c3e9bdb13c4ca8ac23d9d7f690;
        proof1[2] = 0x5439ffff97f42406d94bc69d63f6756d87f3e0d3b2f24e60ccf4a9337c0ebb7b;
        proof1[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof1);
        
        bytes32[] memory proof2 = new bytes32[](4);
        proof2[0] = 0xcd1c413b130d551d31c9e4068914521c9b8683e812cffceb588eefb5bc2d535b;
        proof2[1] = 0xd90e65b73aba76feb50e55aedeb82c46b77cc7cd67804273ddd8af713ab675b3;
        proof2[2] = 0x5439ffff97f42406d94bc69d63f6756d87f3e0d3b2f24e60ccf4a9337c0ebb7b;
        proof2[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof2);
        
        bytes32[] memory proof3 = new bytes32[](4);
        proof3[0] = 0xc6c332d20de5c623bf947df38a21d0472e8dd752fe4f5f99dffd1db8dd53bc1d;
        proof3[1] = 0xd90e65b73aba76feb50e55aedeb82c46b77cc7cd67804273ddd8af713ab675b3;
        proof3[2] = 0x5439ffff97f42406d94bc69d63f6756d87f3e0d3b2f24e60ccf4a9337c0ebb7b;
        proof3[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof3);
        
        bytes32[] memory proof4 = new bytes32[](4);
        proof4[0] = 0x62ee861bd809281b9f5eee64cb46591c31fb09e33e76da8abf772fd28e11aa18;
        proof4[1] = 0x6834d36b9d904d1f0c9aab2b856deb89ac1cc602e480cf35652e5eaeca2d29a0;
        proof4[2] = 0xa8ba4ef70028a593944fe1da9cb9dd3840dca8ce3cb207a85ca81aaf8c07fc0e;
        proof4[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof4);
        
        bytes32[] memory proof5 = new bytes32[](4);
        proof5[0] = 0x61644abd082533753bfc4c75f87069e946f65027681169ab21b89fa55df59d8e;
        proof5[1] = 0x6834d36b9d904d1f0c9aab2b856deb89ac1cc602e480cf35652e5eaeca2d29a0;
        proof5[2] = 0xa8ba4ef70028a593944fe1da9cb9dd3840dca8ce3cb207a85ca81aaf8c07fc0e;
        proof5[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof5);
        
        bytes32[] memory proof6 = new bytes32[](4);
        proof6[0] = 0x21e331efa5520c54b6c1f1b10ca4dcabbe17515393856d356af02cf0715124f0;
        proof6[1] = 0xb84670385419dc1a4c9fc705dd49e93b0d7e6d01f9ad8e78b7c627a8ae37f0c9;
        proof6[2] = 0xa8ba4ef70028a593944fe1da9cb9dd3840dca8ce3cb207a85ca81aaf8c07fc0e;
        proof6[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof6);
        
        bytes32[] memory proof7 = new bytes32[](4);
        proof7[0] = 0xf21a361aeacef454a39d73bebca0ffe246d4327fe361ada5a92ed2673eec156c;
        proof7[1] = 0xb84670385419dc1a4c9fc705dd49e93b0d7e6d01f9ad8e78b7c627a8ae37f0c9;
        proof7[2] = 0xa8ba4ef70028a593944fe1da9cb9dd3840dca8ce3cb207a85ca81aaf8c07fc0e;
        proof7[3] = 0x046e2d31490b129456c668952e2661043eb3eef064147a6bba669326c4c24969;
        whitelistProofs.push(proof7);
        
        bytes32[] memory proof8 = new bytes32[](2);
        proof8[0] = 0x23d4d2016ade93250cdc7ea00ad6493af05d78069c095029eab802c430e5c160;
        proof8[1] = 0x2145bc33b856691d4c948b245a65ff0c39b5f884a99556c697e8d3a0183a1dd3;
        whitelistProofs.push(proof8);
        
        bytes32[] memory proof9 = new bytes32[](2);
        proof9[0] = 0xf70bc2dac90ddb98aed6f3dbe473869ca9fec0e8681de96ed307851eaf415c21;
        proof9[1] = 0x2145bc33b856691d4c948b245a65ff0c39b5f884a99556c697e8d3a0183a1dd3;
        whitelistProofs.push(proof9);
        
        // 3. 给所有用户分配token
        for (uint i = 0; i < whitelist.length; i++) {
            token.transfer(whitelist[i], 1000 ether);
        }
        for (uint i = 0; i < nonWhitelist.length; i++) {
            token.transfer(nonWhitelist[i], 1000 ether);
        }
    }

    // --- 测试用例 ---
    function testWhitelistCanBuy() public {
        uint idx = 0; // 测试第一个白名单用户
        address user = whitelist[idx];
        uint256 amount = whitelistAmounts[idx];
        bytes32[] memory proof = whitelistProofs[idx];
        uint256 deadline = block.timestamp + 1000;
        vm.startPrank(user);
        bytes32 digest = getPermitDigest(address(token), user, address(market), amount, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sk0, digest);
        market.permitPrePay(amount, proof, deadline, v, r, s);
        market.claimNFT();
        assertEq(nft.ownerOf(1), user);
        vm.stopPrank();
    }

    function testNonWhitelistBuyWith200FailsIfNotEnough() public {
        address user = nonWhitelist[0];
        vm.startPrank(user);
        bytes32[] memory proof = new bytes32[](0); // 非白名单
        uint256 amount = 199 ether;
        uint256 deadline = block.timestamp + 1000;
        bytes32 digest = getPermitDigest(address(token), user, address(market), amount, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(nsk0, digest);
        vm.expectRevert();
        market.permitPrePay(amount, proof, deadline, v, r, s);
        vm.stopPrank();
    }

    function testNonWhitelistBuyWith200Succeeds() public {
        address user = nonWhitelist[1];
        vm.startPrank(user);
        bytes32[] memory proof = new bytes32[](0); // 非白名单
        uint256 amount = market.NORMAL_PRICE();
        uint256 deadline = block.timestamp + 1000;
        bytes32 digest = getPermitDigest(address(token), user, address(market), amount, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(nsk1, digest);
        market.permitPrePay(amount, proof, deadline, v, r, s);
        market.claimNFT();
        assertEq(nft.ownerOf(1), user);
        vm.stopPrank();
    }

    function testMulticallWhitelist() public {
        address user = whitelist[1];
        vm.startPrank(user);
        bytes32[] memory proof = whitelistProofs[1];
        uint256 amount = market.WHITELIST_PRICE();
        uint256 deadline = block.timestamp + 1000;
        bytes32 digest = getPermitDigest(address(token), user, address(market), amount, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sk1, digest);
        bytes memory call1 = abi.encodeWithSelector(market.permitPrePay.selector, amount, proof, deadline, v, r, s);
        bytes memory call2 = abi.encodeWithSelector(market.claimNFT.selector);
        bytes[] memory calls = new bytes[](2);
        calls[0] = call1;
        calls[1] = call2;
        market.multicall(calls);
        assertEq(nft.ownerOf(1), user);
        vm.stopPrank();
    }

    function testMulticallNonWhitelist() public {
        address user = nonWhitelist[2];
        vm.startPrank(user);
        bytes32[] memory proof = new bytes32[](0);
        uint256 amount = market.NORMAL_PRICE();
        uint256 deadline = block.timestamp + 1000;
        bytes32 digest = getPermitDigest(address(token), user, address(market), amount, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(nsk2, digest);
        bytes memory call1 = abi.encodeWithSelector(market.permitPrePay.selector, amount, proof, deadline, v, r, s);
        bytes memory call2 = abi.encodeWithSelector(market.claimNFT.selector);
        bytes[] memory calls = new bytes[](2);
        calls[0] = call1;
        calls[1] = call2;
        market.multicall(calls);
        assertEq(nft.ownerOf(1), user);
        vm.stopPrank();
    }

    // --- permit hash工具函数（EIP-2612标准实现）---
    function getPermitDigest(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) internal view returns (bytes32) {
        uint256 nonce = MyToken(token).nonces(owner);
        bytes32 domainSeparator = MyToken(token).DOMAIN_SEPARATOR();
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                owner,
                spender,
                value,
                nonce,
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
} 