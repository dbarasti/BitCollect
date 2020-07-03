pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;
import "./CampaignRewarder.sol";

contract Campaign {
    struct Organizer {
        address organizerAddress;
        bool hasFunded;
    }

    struct Donation {
        uint256 timestamp;
        uint256 amount;
    }

    struct Milestone {
        bool reached;
        uint256 goal;
    }

    modifier is_organizer() {
        Organizer storage org = organizersFundingStatus[msg.sender];
        require(
            msg.sender == org.organizerAddress,
            "Operation not allowed by non-organizer"
        );
        _;
    }

    modifier sums_to_100(uint256[] memory distribution) {
        require(
            distribution.length == beneficiaries.length,
            "Distributions don't match the beneficiaries"
        );
        uint256 sum = 0;
        for (uint256 i = 0; i < distribution.length; i++) {
            sum += distribution[i];
        }
        require(sum == 100, "Sum of distributions should be 100");
        _;
    }

    modifier not_concluded() {
        if (now >= deadline) {
            status = Status.CONCLUDED;
        }
        require(now < deadline, "Campaign has expired");
        _;
    }

    modifier concluded() {
        if (now >= deadline) {
            status = Status.CONCLUDED;
        }
        require(
            status == Status.CONCLUDED,
            "Operation not permitted. Campaign is not concluded"
        );
        _;
    }

    event new_campaign();
    event campaign_initialized();
    event new_donation(address, uint256);
    event beneficiary_withdrew(uint256);
    event contract_deactivated();
    event reward_set();
    event milestone_set();
    event milestone_reached(uint256);
    enum Status {CREATED, ONGOING, CONCLUDED, EMPTY, DISABLED}
    Status private status;
    address[] public organizers;
    address[] public beneficiaries;
    uint256[] private rewardAmounts;
    string[] private rewardPrizes;
    Milestone[] private milestones;
    CampaignRewarder private rewarder;
    uint256 public deadline;
    mapping(address => Organizer) private organizersFundingStatus;
    mapping(address => uint256) private beneficiariesAmounts;
    mapping(address => Donation[]) private donorsHistory;
    mapping(address => string[]) private donorsRewards;
    uint256 initialFundsCounter;
    uint256 private donationsBalance;

    constructor(
        address[] memory _organizers,
        address[] memory _beneficiaries,
        uint256 _deadline
    ) public {
        require(
            _organizers.length > 0 && _beneficiaries.length > 0,
            "Cannot create contract, organizers and/or beneficiaries are empty"
        );
        organizers = _organizers;
        beneficiaries = _beneficiaries;
        deadline = _deadline;
        status = Status.CREATED;
        updateOrganizersState();
        emit new_campaign();
    }

    function updateOrganizersState() private {
        for (uint256 i = 0; i < organizers.length; i++) {
            organizersFundingStatus[organizers[i]] = Organizer({
                organizerAddress: organizers[i],
                hasFunded: false
            });
        }
    }

    function getOrganizers() public view returns (address[] memory) {
        return organizers;
    }

    function getBeneficiaries() public view returns (address[] memory) {
        return beneficiaries;
    }

    function getStatus() public view returns (Status) {
        return status;
    }

    function getBalance() public view returns (uint256) {
        return donationsBalance;
    }

    function donate(uint256[] calldata distribution)
        external
        payable
        not_concluded()
        sums_to_100(distribution)
    {
        require(
            status == Status.ONGOING,
            "Can't accept donations. Organizers must fund the Campaign first"
        );
        distributeFunds(distribution);
        checkForReward();
        checkMilestone();
        emit new_donation(msg.sender, msg.value);
    }

    function initialize(uint256[] calldata distribution)
        external
        payable
        is_organizer()
        not_concluded()
        sums_to_100(distribution)
    {
        require(msg.value > 0, "Initial funding must be > 0");
        require(
            organizersFundingStatus[msg.sender].hasFunded == false,
            "Initial funding already sent"
        );
        organizersFundingStatus[msg.sender].hasFunded = true;
        initialFundsCounter++;
        if (initialFundsCounter == organizers.length) {
            emit campaign_initialized();
            status = Status.ONGOING;
        }
        distributeFunds(distribution);
    }

    function distributeFunds(uint256[] memory distribution) private {
        donationsBalance += msg.value;
        uint256 distributed = 0;
        uint256 change;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            beneficiariesAmounts[beneficiaries[i]] +=
                (msg.value * distribution[i]) /
                100;
            distributed += (msg.value * distribution[i]) / 100;
        }
        change = msg.value - distributed;
        //change (if present) is given to the first beneficiary (just for simplicity)
        if (change > 0) {
            beneficiariesAmounts[beneficiaries[0]] += change;
        }
        donorsHistory[msg.sender].push(
            Donation({timestamp: now, amount: msg.value})
        );
    }

    function hasFunded() public view is_organizer() returns (bool) {
        return organizersFundingStatus[msg.sender].hasFunded;
    }

    function beneficiaryAmount(address beneficiary)
        public
        view
        returns (uint256)
    {
        return beneficiariesAmounts[beneficiary];
    }

    function donationsOf(address donor) public view returns (uint256) {
        return donorsHistory[donor].length;
    }

    function withdraw() public concluded() {
        uint256 amount = beneficiariesAmounts[msg.sender];
        require(
            amount > 0,
            "Error. No amount available or beneficiary non-existing"
        );
        //todo check underflow
        donationsBalance -= beneficiariesAmounts[msg.sender];
        beneficiariesAmounts[msg.sender] = 0;
        if (donationsBalance == 0) {
            status = Status.EMPTY;
        }
        (bool success, ) = msg.sender.call.value(amount)("");
        require(success == true, "Error while withdrawing");
        emit beneficiary_withdrew(amount);
    }

    function deactivate() public is_organizer() {
        if (status == Status.CONCLUDED && donationsBalance == 0) {
            status = Status.EMPTY;
        }
        require(
            status == Status.EMPTY,
            "Operation not permitted. Beneficiaries didn't withdraw"
        );
        require(
            status != Status.DISABLED,
            "Operation not permitted. Contract already disabled"
        );
        status = Status.DISABLED;
        emit contract_deactivated();
    }

    // TODO add force=false parameter to allow override of previous rewards
    function setRewards(uint256[] memory _amounts, string[] memory _prizes)
        public
        is_organizer()
    {
        require(
            rewardAmounts.length == 0,
            "Rewards not set. Configuration already present"
        );
        require(
            _amounts.length == _prizes.length,
            "Rewards not set. Parameter sizes do not match"
        );
        rewardAmounts = _amounts;
        rewardPrizes = _prizes;
        emit reward_set();
    }

    function claimRewards() public view returns (string[] memory) {
        require(
            donorsRewards[msg.sender].length > 0,
            "Cannot claim rewards. None are present"
        );
        return donorsRewards[msg.sender];
    }

    function checkForReward() private {
        if (rewardPrizes.length == 0) return;

        for (uint256 i = 0; i < rewardAmounts.length; i++) {
            if (msg.value >= rewardAmounts[i]) {
                donorsRewards[msg.sender].push(rewardPrizes[i]);
            } else {
                break; // assume sorted rewardAmounts list
            }
        }
    }

    // TODO add force=false parameter to allow override of previous milestones
    function setMilestones(
        uint256[] memory _milestones,
        address payable _rewarder
    ) public is_organizer() {
        require(
            milestones.length == 0,
            "Milestones not set. Configuration already present"
        );
        rewarder = CampaignRewarder(_rewarder);
        for (uint256 i = 0; i < _milestones.length; i++) {
            milestones.push(Milestone({reached: false, goal: _milestones[i]}));
        }
        emit milestone_set();
    }

    function checkMilestone() private {
        if (milestones.length == 0) return;

        for (uint256 i = 0; i < milestones.length; i++) {
            if (
                milestones[i].reached == false &&
                donationsBalance >= milestones[i].goal
            ) {
                // alternatively might be better to remove the entry from the array!
                // in this way we could avoid using the struct
                milestones[i].reached = true;
                // extend deadline by an hour
                deadline += 3600;
                // withdraw from a third-party smart contract
                rewarder.claimReward(address(this));
                emit milestone_reached(milestones[i].goal);
            }
            if (donationsBalance < milestones[i].goal) {
                break; // assume sorted milestones list
            }
        }
    }

    // fallback to receive rewards from CampaignRewarder contract
    function() external payable not_concluded() {
        // receive funds
        donationsBalance += msg.value;
        uint256 distributed = 0;
        uint256 change;
        uint256 equalSplit = beneficiaries.length;
        uint256 amount;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            amount = (msg.value * equalSplit) / 100;
            beneficiariesAmounts[beneficiaries[i]] += amount;
            distributed += amount;
        }
        change = msg.value - distributed;
        //change (if present) is given to the first beneficiary (just for simplicity)
        if (change > 0) {
            beneficiariesAmounts[beneficiaries[0]] += change;
        }
    }

    // TODO use SafeMath
    // TODO define is_ordered() modifier to check arrays
}
