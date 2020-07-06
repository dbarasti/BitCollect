pragma solidity >=0.6.0 <0.7.0;

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
    uint256 private constant PRIZE = 1000000;

    constructor() public {
        owner = msg.sender;
    }

    receive() external payable {}

    function addCampaign(address campaign) public is_owner() {
        campaigns[campaign] = true;
    }

    function claimReward(address campaignAddress) external {
        require(
            campaigns[campaignAddress] == true,
            "Operation not allowed, campaign not registered"
        );
        // since the campaign is added by the same account creating the rewarder,
        // I can suppose that the transfer is authorized

        // send reward of 1000000 wei
        (bool success, ) = campaignAddress.call.value(PRIZE)("");
        require(
            success == true,
            "Error while sending reward. Are there any ether on this account?"
        );
    }
}
