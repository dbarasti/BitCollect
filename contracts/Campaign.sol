pragma solidity 0.5.16;


contract Campaign {
    struct Organizer {
        address organizerAddress;
        bool hasFunded;
    }

    struct Donation {
        bool donated;
        uint256 timestamp;
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

    modifier not_expired() {
        if (now > deadline) {
            status = Status.CONCLUDED;
        }
        require(now < deadline, "Campaign has expired");
        _;
    }

    enum Status {INITIALIZED, ONGOING, CONCLUDED, DISABLED}
    Status public status;
    address[] public organizers;
    address[] public beneficiaries;
    uint256 public deadline;
    mapping(address => Organizer) private organizersFundingStatus;
    mapping(address => uint256) private beneficiariesAmounts;
    mapping(address => Donation[]) private donorsHistory;
    uint256 initialFundsCounter;

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

    function donate(uint256[] calldata distribution)
        external
        payable
        not_expired()
        sums_to_100(distribution)
    {
        require(
            status == Status.ONGOING,
            "Can't accept donations. Organizers must fund the Campaign first"
        );
        distributeFunds(distribution);
    }

    function initialize(uint256[] calldata distribution)
        external
        payable
        is_organizer()
        not_expired()
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
            status = Status.ONGOING;
        }
        distributeFunds(distribution);
    }

    function distributeFunds(uint256[] memory distribution) private {
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            beneficiariesAmounts[beneficiaries[i]] +=
                (msg.value * distribution[i]) /
                100;
        }
        donorsHistory[msg.sender].push(
            Donation({donated: true, timestamp: now})
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
}
