pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

contract Campaign {
    struct Organizer {
        address organizerAddress;
        bool hasFunded;
    }

    // TODO remove donated field if useless
    struct Donation {
        bool donated;
        uint256 timestamp;
        uint256 amount;
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
    enum Status {INITIALIZED, ONGOING, CONCLUDED, EMPTY, DISABLED}
    Status private status;
    address[] public organizers;
    address[] public beneficiaries;
    uint256[] private rewardAmounts;
    string[] private rewardPrizes;
    uint256 public deadline;
    mapping(address => Organizer) private organizersFundingStatus;
    mapping(address => uint256) private beneficiariesAmounts;
    mapping(address => Donation[]) private donorsHistory;
    mapping(address => string[]) private donorsRewards;
    uint256 initialFundsCounter;
    uint256 actualBeneficiariesCount;

    constructor(
        address[] memory _organizers,
        address[] memory _beneficiaries,
        uint256 _deadline
    ) public {
        organizers = _organizers;
        beneficiaries = _beneficiaries;
        deadline = _deadline;
        status = Status.INITIALIZED;
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
        if (rewardAmounts.length > 0) {
            checkForReward();
        }
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

    // TODO handle change
    function distributeFunds(uint256[] memory distribution) private {
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            uint256 prevAmount = beneficiariesAmounts[beneficiaries[i]];
            beneficiariesAmounts[beneficiaries[i]] +=
                (msg.value * distribution[i]) /
                100;
            if (prevAmount == 0 && beneficiariesAmounts[beneficiaries[i]] > 0) {
                actualBeneficiariesCount++;
            }
        }
        donorsHistory[msg.sender].push(
            Donation({donated: true, timestamp: now, amount: msg.value})
        );
    }

    // only organizers can call this function?
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

    function withdraw() public concluded() returns (uint256) {
        uint256 amount = beneficiariesAmounts[msg.sender];
        require(
            amount > 0,
            "Error. No amount available or beneficiary non-existing"
        );
        beneficiariesAmounts[msg.sender] = 0;
        actualBeneficiariesCount--;
        if (actualBeneficiariesCount == 0) {
            status = Status.EMPTY;
        }
        (bool success, ) = msg.sender.call.value(amount)("");
        require(success == true, "Error while withdrawing");
        emit beneficiary_withdrew(amount);
        return amount;
    }

    function deactivate() public {
        if (actualBeneficiariesCount == 0) {
            status = Status.EMPTY;
        }
        require(
            status == Status.EMPTY,
            "Operation not permitted. Beneficiaries didn't withdraw"
        );
        status = Status.DISABLED;
        emit contract_deactivated();
    }

    function setRewards(uint256[] memory _amounts, string[] memory _prizes)
        public
    {
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
        for (uint256 i = 0; i < rewardAmounts.length; i++) {
            if (msg.value >= rewardAmounts[i]) {
                donorsRewards[msg.sender].push(rewardPrizes[i]);
            } else {
                break; // assume sorted rewardAmounts list
            }
        }
    }
}
