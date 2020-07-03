pragma solidity 0.5.16;

contract CampaignRewarder {
    struct Milestone {
        bool reached;
        uint256 goal;
    }
    modifier is_owner() {
        require(
            msg.sender == owner,
            "Operation not allowed. You're not the owner"
        );
        _;
    }

    address owner;
    mapping(address => bool) private campaigns;

    constructor() public {
        owner = msg.sender;
    }

    function() external payable {}

    function addCampaign(address campaign) public is_owner() {
        campaigns[campaign] = true;
    }

    function claimReward(address campaignAddress) external {
        require(
            campaigns[campaignAddress] == true,
            "Operation not allowed, campaign not registered"
        );
        // since the campaign is added by the same account creating the rewarder,
        //

        // send reward of 1000000 wei
        (bool success, ) = campaignAddress.call.value(1000000)("");
        require(
            success == true,
            "Error while sending reward. Are there any ether on this account?"
        );
    }
}
