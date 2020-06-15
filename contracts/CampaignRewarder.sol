pragma solidity 0.5.16;
import "./Campaign.sol";

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

    // mapping(address, Milestone[]) private milestones;

    constructor() public {
        owner = msg.sender;
    }

    function() external payable {}

    function addCampaign(address campaign) public is_owner() {
        campaigns[campaign] = true;
    }

    function claimReward(address campaignAddress) public {
        require(
            campaigns[campaignAddress] == true,
            "Operation not allowed, campaign not registered"
        );
        // since the campaign is added by the same account creating the rewarder,
        //

        // send reward
        (bool success, ) = campaignAddress.call.value(10)("");
        require(success == true, "Error while sending reward");
    }
}
