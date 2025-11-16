// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract CarRental {
    // ============ STRUCTS ============
    
    struct Owner {
        address ownerAddress;
        string username;
        bytes32 loginHash; // Hash key for login
        bool isRegistered;
        uint256 totalEarnings;
        uint256 withdrawableEarnings;
        uint256 totalListings;
    }
    
    struct Renter {
        address renterAddress;
        string username;
        bytes32 loginHash; // Hash key for login
        bool isRegistered;
        uint256 totalBookings;
    }
    
    struct Car {
        uint256 carId;
        address owner;
        string make;
        string model;
        uint256 year;
        string location;
        uint256 dailyRate; // in wei
        bool isAvailable;
        bool isListed;
        uint256 totalBookings;
    }
    
    struct Booking {
        uint256 bookingId;
        uint256 carId;
        address renter;
        address owner;
        uint256 startDate;
        uint256 endDate;
        uint256 totalCost;
        BookingStatus status;
        bool pickupConfirmed;
        bool returnConfirmed;
        bool ownerApproved;
        bool hasDispute;
        uint256 disputeId;
    }
    
    struct Dispute {
        uint256 disputeId;
        uint256 bookingId;
        address initiator; // Owner or Renter who opened the dispute
        string reason;
        DisputeStatus status;
        address arbitrator; // Dispute Arbitrator address
    }
    
    struct Insurance {
        address renter;
        bool isVerified;
        bool isRevoked;
        uint256 verifiedAt;
        address verifier; // Insurance Verifier address
    }
    
    enum BookingStatus {
        Booked,
        Cancelled,
        PickedUp,
        Returned,
        Settled,
        FundsFrozen
    }
    
    enum DisputeStatus {
        Open,
        Resolved,
        Closed
    }
    
    // ============ STATE VARIABLES ============
    
    mapping(address => Owner) public owners;
    mapping(address => Renter) public renters;
    mapping(string => bool) public ownerUsernames; // Track unique owner usernames
    mapping(string => bool) public renterUsernames; // Track unique renter usernames
    mapping(uint256 => Car) public cars;
    mapping(uint256 => Booking) public bookings;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => Insurance) public insuranceRecords;
    
    // Role mappings
    mapping(address => bool) public insuranceVerifiers;
    mapping(address => bool) public disputeArbitrators;
    
    uint256 public carCounter;
    uint256 public bookingCounter;
    uint256 public disputeCounter;
    
    address public contractOwner;
    
    // ============ EVENTS ============
    
    event OwnerRegistered(address indexed owner, string username);
    event RenterRegistered(address indexed renter, string username);
    event CarListed(uint256 indexed carId, address indexed owner, string make, string model);
    event CarEdited(uint256 indexed carId, address indexed owner);
    event CarRemoved(uint256 indexed carId, address indexed owner);
    event BookingCreated(uint256 indexed bookingId, uint256 indexed carId, address indexed renter);
    event BookingCancelled(uint256 indexed bookingId);
    event BookingApproved(uint256 indexed bookingId, address indexed owner);
    event PickupConfirmed(uint256 indexed bookingId, address indexed confirmer);
    event ReturnConfirmed(uint256 indexed bookingId, address indexed confirmer);
    event DisputeOpened(uint256 indexed disputeId, uint256 indexed bookingId, address indexed initiator);
    event DisputeResolved(uint256 indexed disputeId, address indexed arbitrator);
    event InsuranceVerified(address indexed renter, address indexed verifier);
    event InsuranceRevoked(address indexed renter, address indexed verifier);
    event EarningsWithdrawn(address indexed owner, uint256 amount);
    event RatingSubmitted(uint256 indexed bookingId, address indexed rater, address indexed ratee, uint8 rating);
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(owners[msg.sender].isRegistered, "Not a registered owner");
        _;
    }
    
    modifier onlyRenter() {
        require(renters[msg.sender].isRegistered, "Not a registered renter");
        _;
    }
    
    modifier onlyInsuranceVerifier() {
        require(insuranceVerifiers[msg.sender], "Not an insurance verifier");
        _;
    }
    
    modifier onlyDisputeArbitrator() {
        require(disputeArbitrators[msg.sender], "Not a dispute arbitrator");
        _;
    }
    
    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "Not contract owner");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        contractOwner = msg.sender;
    }
    
    // ============ REGISTRATION FUNCTIONS ============
    
    /**
     * @dev Register a new car owner with username and password hash
     * @param _username Unique username for the owner
     * @param _passwordHash Hash of the password (should be computed off-chain)
     */
    function registerOwner(string memory _username, bytes32 _passwordHash) public {
        require(!owners[msg.sender].isRegistered, "Owner already registered");
        require(!ownerUsernames[_username], "Username already taken");
        require(bytes(_username).length > 0, "Username cannot be empty");
        
        owners[msg.sender] = Owner({
            ownerAddress: msg.sender,
            username: _username,
            loginHash: _passwordHash,
            isRegistered: true,
            totalEarnings: 0,
            withdrawableEarnings: 0,
            totalListings: 0
        });
        
        ownerUsernames[_username] = true;
        
        emit OwnerRegistered(msg.sender, _username);
    }
    
    /**
     * @dev Register a new renter with username and password hash
     * @param _username Unique username for the renter
     * @param _passwordHash Hash of the password (should be computed off-chain)
     */
    function registerRenter(string memory _username, bytes32 _passwordHash) public {
        require(!renters[msg.sender].isRegistered, "Renter already registered");
        require(!renterUsernames[_username], "Username already taken");
        require(bytes(_username).length > 0, "Username cannot be empty");
        
        renters[msg.sender] = Renter({
            renterAddress: msg.sender,
            username: _username,
            loginHash: _passwordHash,
            isRegistered: true,
            totalBookings: 0
        });
        
        renterUsernames[_username] = true;
        
        emit RenterRegistered(msg.sender, _username);
    }
    
    /**
     * @dev Verify login for owner using password hash
     * @param _passwordHash Hash of the password to verify
     * @return bool True if login hash matches
     */
    function loginOwner(bytes32 _passwordHash) public view returns (bool) {
        require(owners[msg.sender].isRegistered, "Owner not registered");
        return owners[msg.sender].loginHash == _passwordHash;
    }
    
    /**
     * @dev Verify login for renter using password hash
     * @param _passwordHash Hash of the password to verify
     * @return bool True if login hash matches
     */
    function loginRenter(bytes32 _passwordHash) public view returns (bool) {
        require(renters[msg.sender].isRegistered, "Renter not registered");
        return renters[msg.sender].loginHash == _passwordHash;
    }
    
    // ============ CAR LISTING FUNCTIONS ============
    
    /**
     * @dev List a car for rent
     * @param _make Car make/brand
     * @param _model Car model
     * @param _year Car year
     * @param _location Car location
     * @param _dailyRate Daily rental rate in wei
     */
    function listCar(
        string memory _make,
        string memory _model,
        uint256 _year,
        string memory _location,
        uint256 _dailyRate
    ) public onlyOwner {
        require(_dailyRate > 0, "Daily rate must be greater than 0");
        
        carCounter++;
        uint256 newCarId = carCounter;
        Car storage newCar = cars[newCarId];
        newCar.carId = newCarId;
        newCar.owner = msg.sender;
        newCar.make = _make;
        newCar.model = _model;
        newCar.year = _year;
        newCar.location = _location;
        newCar.dailyRate = _dailyRate;
        newCar.isAvailable = true;
        newCar.isListed = true;
        newCar.totalBookings = 0;
        
        owners[msg.sender].totalListings++;
        
        emit CarListed(newCarId, msg.sender, _make, _model);
    }
    
    /**
     * @dev Edit a car listing
     * @param _carId ID of the car to edit
     * @param _make Updated car make
     * @param _model Updated car model
     * @param _year Updated car year
     * @param _location Updated car location
     * @param _dailyRate Updated daily rental rate
     */
    function editListing(
        uint256 _carId,
        string memory _make,
        string memory _model,
        uint256 _year,
        string memory _location,
        uint256 _dailyRate
    ) public onlyOwner {
        require(cars[_carId].owner == msg.sender, "Not the car owner");
        require(cars[_carId].isListed, "Car not listed");
        require(_dailyRate > 0, "Daily rate must be greater than 0");
        
        cars[_carId].make = _make;
        cars[_carId].model = _model;
        cars[_carId].year = _year;
        cars[_carId].location = _location;
        cars[_carId].dailyRate = _dailyRate;
        
        emit CarEdited(_carId, msg.sender);
    }
    
    /**
     * @dev Remove/unlist a car from rental
     * @param _carId ID of the car to remove
     */
    function removeCar(uint256 _carId) public onlyOwner {
        require(cars[_carId].owner == msg.sender, "Not the car owner");
        require(cars[_carId].isListed, "Car not listed");
        require(cars[_carId].isAvailable, "Cannot remove car with active bookings");
        
        cars[_carId].isListed = false;
        cars[_carId].isAvailable = false;
        
        owners[msg.sender].totalListings--;
        
        emit CarRemoved(_carId, msg.sender);
    }
    
    // ============ BOOKING FUNCTIONS ============
    
    /**
     * @dev Book a car
     * @param _carId ID of the car to book
     * @param _startDate Start date timestamp
     * @param _endDate End date timestamp
     */
    function bookCar(
        uint256 _carId,
        uint256 _startDate,
        uint256 _endDate
    ) public payable onlyRenter {
        Car storage car = cars[_carId];
        require(car.isListed && car.isAvailable, "Car not available");
        require(_startDate < _endDate && _startDate >= block.timestamp, "Invalid dates");
        Insurance storage insurance = insuranceRecords[msg.sender];
        require(insurance.isVerified && !insurance.isRevoked, "Insurance not verified");
        
        uint256 totalCost = car.dailyRate * ((_endDate - _startDate) / 1 days);
        require(msg.value >= totalCost, "Insufficient payment");
        
        bookingCounter++;
        Booking storage newBooking = bookings[bookingCounter];
        newBooking.bookingId = bookingCounter;
        newBooking.carId = _carId;
        newBooking.renter = msg.sender;
        newBooking.owner = car.owner;
        newBooking.startDate = _startDate;
        newBooking.endDate = _endDate;
        newBooking.totalCost = totalCost;
        newBooking.status = BookingStatus.Booked;
        
        car.isAvailable = false;
        car.totalBookings++;
        renters[msg.sender].totalBookings++;
        
        emit BookingCreated(bookingCounter, _carId, msg.sender);
    }
    
    /**
     * @dev Cancel a booking
     * @param _bookingId ID of the booking to cancel
     */
    function cancelBooking(uint256 _bookingId) public {
        Booking storage booking = bookings[_bookingId];
        require(booking.renter == msg.sender, "Not the renter");
        require(booking.status == BookingStatus.Booked, "Booking cannot be cancelled");
        
        booking.status = BookingStatus.Cancelled;
        cars[booking.carId].isAvailable = true;
        
        // Refund to renter
        payable(booking.renter).transfer(booking.totalCost);
        
        emit BookingCancelled(_bookingId);
    }
    
    /**
     * @dev Approve a booking (by owner)
     * @param _bookingId ID of the booking to approve
     */
    function approveBooking(uint256 _bookingId) public onlyOwner {
        Booking storage booking = bookings[_bookingId];
        require(booking.owner == msg.sender, "Not the car owner");
        require(booking.status == BookingStatus.Booked, "Booking not in Booked status");
        
        booking.ownerApproved = true;
        
        emit BookingApproved(_bookingId, msg.sender);
    }
    
    /**
     * @dev Confirm pickup
     * @param _bookingId ID of the booking
     */
    function confirmPickup(uint256 _bookingId) public {
        Booking storage booking = bookings[_bookingId];
        require(booking.renter == msg.sender || booking.owner == msg.sender, "Not authorized");
        require(booking.status == BookingStatus.Booked, "Booking not in Booked status");
        require(block.timestamp >= booking.startDate, "Pickup time not reached");
        
        booking.pickupConfirmed = true;
        booking.status = BookingStatus.PickedUp;
        
        emit PickupConfirmed(_bookingId, msg.sender);
    }
    
    /**
     * @dev Confirm return
     * @param _bookingId ID of the booking
     */
    function confirmReturn(uint256 _bookingId) public {
        Booking storage booking = bookings[_bookingId];
        require(booking.renter == msg.sender || booking.owner == msg.sender, "Not authorized");
        require(booking.status == BookingStatus.PickedUp, "Car not picked up");
        require(block.timestamp >= booking.endDate, "Return time not reached");
        
        booking.returnConfirmed = true;
        booking.status = BookingStatus.Returned;
        cars[booking.carId].isAvailable = true;
        
        // Check if overdue
        if (block.timestamp > booking.endDate) {
            // Can trigger dispute if needed
        }
        
        emit ReturnConfirmed(_bookingId, msg.sender);
    }
    
    // ============ DISPUTE FUNCTIONS ============
    
    /**
     * @dev Open a dispute for a booking
     * @param _bookingId ID of the booking
     * @param _reason Reason for the dispute
     */
    function openDispute(uint256 _bookingId, string memory _reason) public {
        Booking storage booking = bookings[_bookingId];
        require(booking.renter == msg.sender || booking.owner == msg.sender, "Not authorized");
        require(booking.status == BookingStatus.Returned || booking.status == BookingStatus.PickedUp, "Cannot open dispute");
        require(!booking.hasDispute, "Dispute already exists");
        
        disputeCounter++;
        disputes[disputeCounter] = Dispute({
            disputeId: disputeCounter,
            bookingId: _bookingId,
            initiator: msg.sender,
            reason: _reason,
            status: DisputeStatus.Open,
            arbitrator: address(0)
        });
        
        booking.hasDispute = true;
        booking.disputeId = disputeCounter;
        booking.status = BookingStatus.FundsFrozen;
        
        emit DisputeOpened(disputeCounter, _bookingId, msg.sender);
    }
    
    /**
     * @dev Resolve a dispute (by arbitrator)
     * @param _disputeId ID of the dispute
     * @param _winner Address of the winner (owner or renter)
     */
    function resolveDispute(uint256 _disputeId, address _winner) public onlyDisputeArbitrator {
        Dispute storage dispute = disputes[_disputeId];
        require(dispute.status == DisputeStatus.Open, "Dispute not open");
        
        Booking storage booking = bookings[dispute.bookingId];
        require(booking.hasDispute, "Booking has no dispute");
        
        dispute.status = DisputeStatus.Resolved;
        dispute.arbitrator = msg.sender;
        booking.status = BookingStatus.Settled;
        
        // Transfer funds to winner
        if (_winner == booking.owner) {
            owners[booking.owner].withdrawableEarnings += booking.totalCost;
            owners[booking.owner].totalEarnings += booking.totalCost;
        } else {
            payable(booking.renter).transfer(booking.totalCost);
        }
        
        emit DisputeResolved(_disputeId, msg.sender);
    }
    
    // ============ SETTLEMENT FUNCTIONS ============
    
    /**
     * @dev Settle a booking (when no dispute)
     * @param _bookingId ID of the booking
     */
    function settleBooking(uint256 _bookingId) public {
        Booking storage booking = bookings[_bookingId];
        require(booking.status == BookingStatus.Returned, "Booking not returned");
        require(!booking.hasDispute, "Booking has active dispute");
        require(booking.owner == msg.sender || booking.renter == msg.sender, "Not authorized");
        
        booking.status = BookingStatus.Settled;
        owners[booking.owner].withdrawableEarnings += booking.totalCost;
        owners[booking.owner].totalEarnings += booking.totalCost;
    }
    
    /**
     * @dev Withdraw earnings (by owner)
     */
    function withdrawEarnings() public onlyOwner {
        uint256 amount = owners[msg.sender].withdrawableEarnings;
        require(amount > 0, "No earnings to withdraw");
        
        owners[msg.sender].withdrawableEarnings = 0;
        payable(msg.sender).transfer(amount);
        
        emit EarningsWithdrawn(msg.sender, amount);
    }
    
    // ============ INSURANCE FUNCTIONS ============
    
    /**
     * @dev Verify insurance for a renter
     * @param _renter Address of the renter
     */
    function verifyInsurance(address _renter) public onlyInsuranceVerifier {
        require(renters[_renter].isRegistered, "Renter not registered");
        require(!insuranceRecords[_renter].isVerified || insuranceRecords[_renter].isRevoked, "Insurance already verified");
        
        insuranceRecords[_renter] = Insurance({
            renter: _renter,
            isVerified: true,
            isRevoked: false,
            verifiedAt: block.timestamp,
            verifier: msg.sender
        });
        
        emit InsuranceVerified(_renter, msg.sender);
    }
    
    /**
     * @dev Revoke insurance for a renter
     * @param _renter Address of the renter
     */
    function revokeInsurance(address _renter) public onlyInsuranceVerifier {
        require(insuranceRecords[_renter].isVerified, "Insurance not verified");
        
        insuranceRecords[_renter].isRevoked = true;
        
        emit InsuranceRevoked(_renter, msg.sender);
    }
    
    // ============ RATING FUNCTIONS ============
    
    /**
     * @dev Rate a renter (by owner)
     * @param _bookingId ID of the booking
     * @param _rating Rating value (1-5)
     */
    function rateRenter(uint256 _bookingId, uint8 _rating) public onlyOwner {
        Booking storage booking = bookings[_bookingId];
        require(booking.owner == msg.sender, "Not the car owner");
        require(booking.status == BookingStatus.Settled, "Booking not settled");
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");
        
        emit RatingSubmitted(_bookingId, msg.sender, booking.renter, _rating);
    }
    
    /**
     * @dev Rate an owner (by renter)
     * @param _bookingId ID of the booking
     * @param _rating Rating value (1-5)
     */
    function rateOwner(uint256 _bookingId, uint8 _rating) public onlyRenter {
        Booking storage booking = bookings[_bookingId];
        require(booking.renter == msg.sender, "Not the renter");
        require(booking.status == BookingStatus.Settled, "Booking not settled");
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");
        
        emit RatingSubmitted(_bookingId, msg.sender, booking.owner, _rating);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Add an insurance verifier
     * @param _verifier Address of the verifier
     */
    function addInsuranceVerifier(address _verifier) public onlyContractOwner {
        insuranceVerifiers[_verifier] = true;
    }
    
    /**
     * @dev Remove an insurance verifier
     * @param _verifier Address of the verifier
     */
    function removeInsuranceVerifier(address _verifier) public onlyContractOwner {
        insuranceVerifiers[_verifier] = false;
    }
    
    /**
     * @dev Add a dispute arbitrator
     * @param _arbitrator Address of the arbitrator
     */
    function addDisputeArbitrator(address _arbitrator) public onlyContractOwner {
        disputeArbitrators[_arbitrator] = true;
    }
    
    /**
     * @dev Remove a dispute arbitrator
     * @param _arbitrator Address of the arbitrator
     */
    function removeDisputeArbitrator(address _arbitrator) public onlyContractOwner {
        disputeArbitrators[_arbitrator] = false;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get owner information
     * @param _owner Address of the owner
     */
    function getOwner(address _owner) public view returns (
        address ownerAddress,
        string memory username,
        bool isRegistered,
        uint256 totalEarnings,
        uint256 withdrawableEarnings,
        uint256 totalListings
    ) {
        Owner storage o = owners[_owner];
        ownerAddress = o.ownerAddress;
        username = o.username;
        isRegistered = o.isRegistered;
        totalEarnings = o.totalEarnings;
        withdrawableEarnings = o.withdrawableEarnings;
        totalListings = o.totalListings;
    }
    
    /**
     * @dev Get renter information
     * @param _renter Address of the renter
     */
    function getRenter(address _renter) public view returns (
        address renterAddress,
        string memory username,
        bool isRegistered,
        uint256 totalBookings
    ) {
        Renter storage r = renters[_renter];
        renterAddress = r.renterAddress;
        username = r.username;
        isRegistered = r.isRegistered;
        totalBookings = r.totalBookings;
    }
    
    /**
     * @dev Get car basic information
     * @param _carId ID of the car
     */
    function getCarBasic(uint256 _carId) public view returns (
        uint256 carId,
        address owner,
        string memory make,
        string memory model,
        uint256 year
    ) {
        Car storage c = cars[_carId];
        carId = c.carId;
        owner = c.owner;
        make = c.make;
        model = c.model;
        year = c.year;
    }
    
    /**
     * @dev Get car rental information
     * @param _carId ID of the car
     */
    function getCarRental(uint256 _carId) public view returns (
        string memory location,
        uint256 dailyRate,
        bool isAvailable,
        bool isListed
    ) {
        Car storage c = cars[_carId];
        location = c.location;
        dailyRate = c.dailyRate;
        isAvailable = c.isAvailable;
        isListed = c.isListed;
    }
    
    /**
     * @dev Get booking basic information
     * @param _bookingId ID of the booking
     */
    function getBookingBasic(uint256 _bookingId) public view returns (
        uint256 bookingId,
        uint256 carId,
        address renter,
        address owner
    ) {
        Booking storage b = bookings[_bookingId];
        bookingId = b.bookingId;
        carId = b.carId;
        renter = b.renter;
        owner = b.owner;
    }
    
    /**
     * @dev Get booking dates and cost
     * @param _bookingId ID of the booking
     */
    function getBookingDates(uint256 _bookingId) public view returns (
        uint256 startDate,
        uint256 endDate,
        uint256 totalCost
 ) {
        Booking storage b = bookings[_bookingId];
        startDate = b.startDate;
        endDate = b.endDate;
        totalCost = b.totalCost;
    }
    
    /**
     * @dev Get booking status information
     * @param _bookingId ID of the booking
     */
    function getBookingStatus(uint256 _bookingId) public view returns (
        BookingStatus status,
        bool pickupConfirmed,
        bool returnConfirmed,
        bool ownerApproved,
        bool hasDispute
    ) {
        Booking storage b = bookings[_bookingId];
        status = b.status;
        pickupConfirmed = b.pickupConfirmed;
        returnConfirmed = b.returnConfirmed;
        ownerApproved = b.ownerApproved;
        hasDispute = b.hasDispute;
    }
}

