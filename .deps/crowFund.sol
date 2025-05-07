// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

error DeadLineOver();
contract CrowdFunding {
    struct Campaign {
        address owner;         // 发起人
        string title;          // 商品名
        string description;    // 描述 
        uint target;           // 目标金额
        uint deadline;         // 截止日
        uint amountCollected;  // 已筹集金额
        string image;          // 商品图链接
        address[] donators;    // 众筹者地址
        uint[] donations;      // 众筹金额
    }

    mapping (uint => Campaign) public campaigns;

    uint public numberOfCampaigns = 0;

    function createCampagin(
        address _owner,
        string memory _title,
        string memory _description,
        uint _target,
        uint _deadline,
        string memory _image
    ) public returns (uint) {
        Campaign storage campaign = campaigns[numberOfCampaigns];

        if(campaign.deadline >= block.timestamp){
            revert DeadLineOver();            
        }

        campaign.owner = _owner;
        campaign.title = _title;
        campaign.description = _description;
        campaign.target = _target;
        campaign.deadline = _deadline;
        campaign.amountCollected = 0; // 一开始都是没人投的
        campaign.image = _image;

        numberOfCampaigns++;

        return numberOfCampaigns - 1;
    }

    // 游客给指定品号id的艺术捐钱
    function donateToCampaign(uint _id) public payable {
        uint amount = msg.value;
        Campaign storage campaign = campaigns[_id];

        campaign.donators.push(msg.sender);
        campaign.donations.push(amount);

        (bool sent,) = payable(campaign.owner).call{value: amount}("");

        if(sent) {
            campaign.amountCollected += amount;
        }
    }

    // 查一个id下的所有捐赠人，以及对应卷了多少钱
    function getDonators(uint _id) public view returns (address[] memory, uint[] memory) {
        return (campaigns[_id].donators, campaigns[_id].donations);
    }

    // 查所有的的艺术品数组（遍历）
    function getCampaigns() public view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](numberOfCampaigns);

        for (uint i = 0; i < numberOfCampaigns; i++) {
            Campaign storage item = campaigns[i];
            allCampaigns[i] = item;
        }

        return allCampaigns;
    }
}