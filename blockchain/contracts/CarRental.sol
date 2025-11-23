// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CarRental {
    /* =========================== Roles & Config =========================== */

    address public contractOwner;         // contract owner (platform admin)
    address public insuranceVerifier;     // role
    address public arbitrator;            // role
    uint16  public platformFeeBps;        // optional marketplace fee on rental (not deposit), e.g., 200 = 2%

    modifier onlyOwner() { require(msg.sender == contractOwner, "not contract owner"); _; }
    modifier onlyInsurance() { require(msg.sender == insuranceVerifier, "not insurance"); _; }
    modifier onlyArbitrator() { require(msg.sender == arbitrator, "not arbitrator"); _; }

    constructor(address _insuranceVerifier, address _arbitrator, uint16 _feeBps) {
        contractOwner = msg.sender;
        insuranceVerifier = _insuranceVerifier;
        arbitrator = _arbitrator;
        platformFeeBps = _feeBps; // can be 0
    }

    function setRoles(address _insuranceVerifier, address _arbitrator) external onlyOwner {
        insuranceVerifier = _insuranceVerifier;
        arbitrator = _arbitrator;
    }

    function setPlatformFee(uint16 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee too high");
        platformFeeBps = _feeBps;
    }

    /* ================================ Users =============================== */

    struct User {
        bool registered;
    }
    mapping(address => User) public users;

    event UserRegistered(address indexed user);

    function register() external {
        require(!users[msg.sender].registered, "already");
        users[msg.sender].registered = true;
        emit UserRegistered(msg.sender);
    }

    /* =============================== Listings ============================= */

    struct Listing {
        address payable carOwner;         // car owner (listing creator)
        uint256 dailyPrice;        // in wei per day
        uint256 securityDeposit;   // in wei
        bool    active;            // car owner can pause/unpause
        bool    insuranceValid;    // set by InsuranceVerifier
        string  insuranceDocURI;   // optional
        string  make;              // car make/brand
        string  model;             // car model
        uint256 year;              // car year
        string  location;          // car location
    }
    Listing[] public listings;

    event ListingCreated(uint256 indexed listingId, address indexed carOwner);
    event ListingEdited(uint256 indexed listingId);
    event ListingActive(uint256 indexed listingId, bool active);
    event InsuranceVerified(uint256 indexed listingId, bool valid);

    function createListing(
        uint256 dailyPrice,
        uint256 securityDeposit,
        string calldata insuranceDocURI,
        string calldata make,
        string calldata model,
        uint256 year,
        string calldata location
    ) external returns (uint256 id) {
        require(users[msg.sender].registered, "register first");
        require(msg.sender != insuranceVerifier, "insurance verifier cannot create listings");
        require(msg.sender != arbitrator, "arbitrator cannot create listings");
        require(dailyPrice > 0, "bad price");
        require(year > 1900 && year <= 2100, "invalid year");
        listings.push(Listing({
            carOwner: payable(msg.sender),
            dailyPrice: dailyPrice,
            securityDeposit: securityDeposit,
            active: true,
            insuranceValid: false,
            insuranceDocURI: insuranceDocURI,
            make: make,
            model: model,
            year: year,
            location: location
        }));
        id = listings.length - 1;
        emit ListingCreated(id, msg.sender);
    }

    function editListing(
        uint256 listingId,
        uint256 dailyPrice,
        uint256 securityDeposit,
        string calldata insuranceDocURI,
        string calldata make,
        string calldata model,
        uint256 year,
        string calldata location
    ) external {
        Listing storage L = listings[listingId];
        require(msg.sender == L.carOwner, "not car owner");
        require(dailyPrice > 0, "bad price");
        require(year > 1900 && year <= 2100, "invalid year");
        L.dailyPrice = dailyPrice;
        L.securityDeposit = securityDeposit;
        L.insuranceDocURI = insuranceDocURI;
        L.make = make;
        L.model = model;
        L.year = year;
        L.location = location;
        emit ListingEdited(listingId);
    }

    function setListingActive(uint256 listingId, bool active_) external {
        Listing storage L = listings[listingId];
        require(msg.sender == L.carOwner, "not car owner");
        L.active = active_;
        emit ListingActive(listingId, active_);
    }

    function verifyInsurance(uint256 listingId, bool valid) external onlyInsurance {
        listings[listingId].insuranceValid = valid;
        emit InsuranceVerified(listingId, valid);
    }

    /* =============================== Bookings ============================= */

    enum BookingStatus {
        None,
        Requested,     // renter escrowed funds; waiting for car owner approve/reject
        Approved,      // pickup pending
        Active,        // pickup confirmed by both
        ReturnPending, // one party has confirmed return
        Completed,     // funds split; ratings enabled
        Rejected,      // rejected by car owner; refunded
        Cancelled,     // cancelled before activation; refunded
        Disputed       // arbitrator must resolve
    }

    struct Booking {
        // immutable-ish
        uint256 listingId;
        address payable renter;
        uint64  startDate;   // unix seconds
        uint64  endDate;     // unix seconds
        uint256 rentalCost;  // computed and locked at request time
        uint256 deposit;     // copied from listing at request time

        // status
        BookingStatus status;
        bool renterPickup;
        bool ownerPickup;
        bool renterReturn;
        bool ownerReturn;

        // evidence URIs (optional)
        string pickupProofURI_renter;
        string pickupProofURI_owner;
        string returnProofURI_renter;
        string returnProofURI_owner;

        // accounting
        uint256 escrow; // rentalCost + deposit, held until completion or dispute
    }

    Booking[] public bookings;

    event BookingRequested(uint256 indexed bookingId, uint256 indexed listingId, address indexed renter, uint256 escrow);
    event BookingApproved(uint256 indexed bookingId);
    event BookingRejected(uint256 indexed bookingId);
    event PickupConfirmed(uint256 indexed bookingId, address indexed by);
    event ReturnConfirmed(uint256 indexed bookingId, address indexed by);
    event BookingCompleted(uint256 indexed bookingId, uint256 ownerCredit, uint256 renterCredit, uint256 fee);
    event BookingDisputed(uint256 indexed bookingId, address indexed by);
    event BookingCancelled(uint256 indexed bookingId);

    // Pull-payment balances
    mapping(address => uint256) public balances;

    // simple, gas-cheap reentrancy guard
    uint256 private locked = 1;
    modifier nonReentrant() {
        require(locked == 1, "reentrancy");
        locked = 2;
        _;
        locked = 1;
    }

    function daysBetween(uint64 a, uint64 b) internal pure returns (uint256) {
        require(b > a, "end>start");
        return (uint256(b) - uint256(a)) / 1 days;
    }

    function requestBooking(
        uint256 listingId,
        uint64 startDate,
        uint64 endDate
    ) external payable returns (uint256 id) {
        require(users[msg.sender].registered, "register first");
        require(msg.sender != insuranceVerifier, "insurance verifier cannot book cars");
        require(msg.sender != arbitrator, "arbitrator cannot book cars");
        Listing storage L = listings[listingId];
        require(msg.sender != L.carOwner, "cannot book own listing");
        require(L.active, "listing inactive");
        require(L.insuranceValid, "insurance not valid");
        require(startDate >= block.timestamp, "start date must be in the future");
        uint256 numDays = daysBetween(startDate, endDate);
        require(numDays > 0, "min 1 day");

        uint256 rentalCost = L.dailyPrice * numDays;
        uint256 total = rentalCost + L.securityDeposit;
        require(msg.value == total, "incorrect escrow");

        bookings.push();
        id = bookings.length - 1;
        Booking storage B = bookings[id];
        B.listingId = listingId;
        B.renter = payable(msg.sender);
        B.startDate = startDate;
        B.endDate = endDate;
        B.rentalCost = rentalCost;
        B.deposit = L.securityDeposit;
        B.status = BookingStatus.Requested;
        B.escrow = total;

        emit BookingRequested(id, listingId, msg.sender, total);
    }

    function approveBooking(uint256 bookingId) external {
        Booking storage B = bookings[bookingId];
        Listing storage L = listings[B.listingId];
        require(msg.sender == L.carOwner, "not car owner");
        require(B.status == BookingStatus.Requested, "bad status");
        B.status = BookingStatus.Approved;
        emit BookingApproved(bookingId);
    }

    function rejectBooking(uint256 bookingId) external nonReentrant {
        Booking storage B = bookings[bookingId];
        Listing storage L = listings[B.listingId];
        require(msg.sender == L.carOwner, "not car owner");
        require(B.status == BookingStatus.Requested, "bad status");
        uint256 refund = B.escrow;
        B.escrow = 0;
        B.status = BookingStatus.Rejected;
        _safeTransfer(B.renter, refund);
        emit BookingRejected(bookingId);
    }

    function cancelBeforeActive(uint256 bookingId) external nonReentrant {
        Booking storage B = bookings[bookingId];
        require(B.status == BookingStatus.Requested || B.status == BookingStatus.Approved, "cannot cancel");
        require(msg.sender == B.renter, "only renter");
        uint256 refund = B.escrow;
        B.escrow = 0;
        B.status = BookingStatus.Cancelled;
        _safeTransfer(B.renter, refund);
        emit BookingCancelled(bookingId);
    }

    function confirmPickup(uint256 bookingId, string calldata proofURI) external {
        Booking storage B = bookings[bookingId];
        Listing storage L = listings[B.listingId];
        require(B.status == BookingStatus.Approved, "not approved");
        if (msg.sender == B.renter) {
            B.renterPickup = true;
            B.pickupProofURI_renter = proofURI;
        } else if (msg.sender == L.carOwner) {
            B.ownerPickup = true;
            B.pickupProofURI_owner = proofURI;
        } else {
            revert("not party");
        }
        emit PickupConfirmed(bookingId, msg.sender);
        if (B.renterPickup && B.ownerPickup) {
            B.status = BookingStatus.Active;
        }
    }

    function confirmReturn(uint256 bookingId, string calldata proofURI) external nonReentrant {
        Booking storage B = bookings[bookingId];
        Listing storage L = listings[B.listingId];
        require(B.status == BookingStatus.Active || B.status == BookingStatus.ReturnPending, "not active");

        if (msg.sender == B.renter) {
            B.renterReturn = true;
            B.returnProofURI_renter = proofURI;
        } else if (msg.sender == L.carOwner) {
            B.ownerReturn = true;
            B.returnProofURI_owner = proofURI;
        } else {
            revert("not party");
        }
        emit ReturnConfirmed(bookingId, msg.sender);

        if (B.renterReturn && B.ownerReturn) {
            // No dispute: settle immediately
            _completeWithoutDispute(bookingId);
        } else {
            B.status = BookingStatus.ReturnPending;
        }
    }

    function openDispute(uint256 bookingId) external {
        Booking storage B = bookings[bookingId];
        Listing storage L = listings[B.listingId];
        require(
            msg.sender == B.renter || msg.sender == L.carOwner,
            "not party"
        );
        require(
            B.status == BookingStatus.Approved ||
            B.status == BookingStatus.Active ||
            B.status == BookingStatus.ReturnPending,
            "bad status"
        );
        B.status = BookingStatus.Disputed;
        emit BookingDisputed(bookingId, msg.sender);
    }

    function resolveDispute(uint256 bookingId, uint256 ownerPayout, uint256 renterPayout)
        external
        nonReentrant
        onlyArbitrator
    {
        Booking storage B = bookings[bookingId];
        Listing storage L = listings[B.listingId];
        require(B.status == BookingStatus.Disputed, "not disputed");
        require(ownerPayout + renterPayout == B.escrow, "must split escrow");

        uint256 fee = (ownerPayout * platformFeeBps) / 10_000;
        uint256 ownerNet = ownerPayout - fee;

        balances[L.carOwner] += ownerNet;
        balances[B.renter] += renterPayout;
        balances[contractOwner] += fee;

        B.escrow = 0;
        B.status = BookingStatus.Completed;

        emit BookingCompleted(bookingId, ownerNet, renterPayout, fee);
    }

    function _completeWithoutDispute(uint256 bookingId) internal {
        Booking storage B = bookings[bookingId];
        Listing storage L = listings[B.listingId];
        require(
            B.status == BookingStatus.Active || B.status == BookingStatus.ReturnPending,
            "bad status"
        );

        uint256 fee = (B.rentalCost * platformFeeBps) / 10_000;
        uint256 ownerNet = B.rentalCost - fee;
        uint256 renterBack = B.deposit;

        require(B.escrow == B.rentalCost + B.deposit, "escrow mismatch");
        balances[L.carOwner] += ownerNet;
        balances[B.renter]   += renterBack;
        balances[contractOwner]      += fee;

        B.escrow = 0;
        B.status = BookingStatus.Completed;

        emit BookingCompleted(bookingId, ownerNet, renterBack, fee);
    }

    /* ================================ Ratings ============================= */

    struct Rating { uint8 value; bool set; }
    // bookingId => ratings
    mapping(uint256 => Rating) public rateOwnerScore;
    mapping(uint256 => Rating) public rateRenterScore;

    function rateOwner(uint256 bookingId, uint8 score) external {
        Booking storage B = bookings[bookingId];
        require(B.status == BookingStatus.Completed, "not completed");
        require(msg.sender == B.renter, "only renter");
        require(score >= 1 && score <= 5, "1..5");
        require(!rateOwnerScore[bookingId].set, "rated");
        rateOwnerScore[bookingId] = Rating(score, true);
    }

    function rateRenter(uint256 bookingId, uint8 score) external {
        Booking storage B = bookings[bookingId];
        address carOwner = listings[B.listingId].carOwner;
        require(B.status == BookingStatus.Completed, "not completed");
        require(msg.sender == carOwner, "only car owner");
        require(score >= 1 && score <= 5, "1..5");
        require(!rateRenterScore[bookingId].set, "rated");
        rateRenterScore[bookingId] = Rating(score, true);
    }

    /* ================================ Funds =============================== */

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "nothing to withdraw");
        balances[msg.sender] = 0;
        _safeTransfer(payable(msg.sender), amount);
    }

    function _safeTransfer(address payable to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
