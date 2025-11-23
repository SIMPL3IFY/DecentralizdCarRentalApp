import { web3Service } from "./web3Service";
import { CONTRACT_ABI_PATH, GAS_LIMITS } from "../constants/config";
import { BookingStatus } from "../constants/bookingStatus";

/**
 * CarRental Contract Service
 */
class ContractService {
    constructor() {
        this.contract = null;
        this.contractAddress = null;
    }

    /**
     * Load contract from address
     */
    async loadContract(contractAddress) {
        try {
            const web3 = web3Service.getWeb3();
            if (!web3) {
                throw new Error("Web3 not initialized");
            }

            // Check if contract exists at this address
            const code = await web3.eth.getCode(contractAddress);
            if (!code || code === "0x" || code === "0x0") {
                throw new Error(
                    "No contract found at this address. The address is valid but no contract is deployed there."
                );
            }

            const response = await fetch(CONTRACT_ABI_PATH);
            const artifact = await response.json();
            const abi = artifact.abi;

            this.contract = new web3.eth.Contract(abi, contractAddress);
            this.contractAddress = contractAddress;

            return { success: true, contract: this.contract };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get contract instance
     */
    getContract() {
        return this.contract;
    }

    /**
     * Get contract address
     */
    getContractAddress() {
        return this.contractAddress;
    }

    /**
     * Check if contract is loaded
     */
    isLoaded() {
        return this.contract !== null;
    }

    // ==================== Helper Methods ====================

    /**
     * Parse listing data from contract response
     */
    _parseListing(listing, listingId) {
        const owner = listing.carOwner || listing[0];
        const dailyPrice = listing.dailyPrice || listing[1];
        const deposit = listing.securityDeposit || listing[2];
        const active =
            listing.active !== undefined ? listing.active : listing[3];
        const insuranceValid =
            listing.insuranceValid !== undefined
                ? listing.insuranceValid
                : listing[4];
        const insuranceDocURI = listing.insuranceDocURI || listing[5] || "";
        const make = listing.make || listing[6] || "";
        const model = listing.model || listing[7] || "";
        const year = listing.year
            ? Number(listing.year)
            : listing[8]
            ? Number(listing[8])
            : 0;
        const location = listing.location || listing[9] || "";

        return {
            id: listingId,
            owner,
            dailyPrice: web3Service.fromWei(dailyPrice.toString(), "ether"),
            deposit: web3Service.fromWei(deposit.toString(), "ether"),
            active: Boolean(active),
            insuranceValid: Boolean(insuranceValid),
            insuranceDocURI,
            make,
            model,
            year,
            location,
        };
    }

    /**
     * Check if listing exists (not zero address and has price)
     */
    _isValidListing(listing) {
        const carOwner = listing.carOwner || listing[0];
        const dailyPrice = listing.dailyPrice || listing[1];

        return (
            carOwner &&
            carOwner !== "0x0000000000000000000000000000000000000000" &&
            carOwner !== "0x" &&
            (!dailyPrice || BigInt(dailyPrice.toString()) !== 0n)
        );
    }

    /**
     * Extract revert reason from error
     */
    _extractRevertReason(error) {
        if (error.message) {
            const match =
                error.message.match(/revert\s+(.+)/i) ||
                error.message.match(/execution reverted:\s*(.+)/i);
            if (match) return match[1].trim();
            if (error.message.includes("already")) return "already";
            return error.message;
        }
        return "Unknown error";
    }

    /**
     * Parse booking data from contract response
     */
    _parseBooking(booking, bookingId, listing = null) {
        const baseBooking = {
            id: bookingId,
            listingId: Number(booking.listingId),
            renter: booking.renter,
            startDate: new Date(Number(booking.startDate) * 1000),
            endDate: new Date(Number(booking.endDate) * 1000),
            status: Number(booking.status),
            rentalCost: web3Service.fromWei(booking.rentalCost, "ether"),
            deposit: web3Service.fromWei(booking.deposit, "ether"),
            escrow: web3Service.fromWei(booking.escrow, "ether"),
            renterPickup: booking.renterPickup,
            ownerPickup: booking.ownerPickup,
            renterReturn: booking.renterReturn,
            ownerReturn: booking.ownerReturn,
        };

        if (listing) {
            baseBooking.listing = listing;
        }

        if (booking.pickupProofURI_renter !== undefined) {
            baseBooking.pickupProofURI_renter = booking.pickupProofURI_renter;
            baseBooking.pickupProofURI_owner = booking.pickupProofURI_owner;
            baseBooking.returnProofURI_renter = booking.returnProofURI_renter;
            baseBooking.returnProofURI_owner = booking.returnProofURI_owner;
        }

        return baseBooking;
    }

    /**
     * Convert Web3 result to boolean
     */
    _toBoolean(result) {
        if (typeof result === "boolean") return result;
        if (result && typeof result === "object") {
            if ("registered" in result && result.registered !== undefined) {
                return Boolean(result.registered);
            }
            if (result[0] !== undefined) return Boolean(result[0]);
            if (typeof result.toString === "function") {
                const str = result.toString();
                return str === "true" || str === "1";
            }
        }
        return Boolean(result);
    }

    // ==================== User Functions ====================

    /**
     * Register user
     */
    async register() {
        const account = web3Service.getAccount();
        const web3 = web3Service.getWeb3();

        // Check if already registered first
        const alreadyRegistered = await this.isRegistered(account);
        if (alreadyRegistered) {
            throw new Error("User is already registered");
        }

        // Try to simulate the call first to get revert reason
        try {
            await this.contract.methods.register().call({ from: account });
        } catch (callError) {
            const revertReason = this._extractRevertReason(callError);
            throw new Error(`Transaction will revert: ${revertReason}`);
        }

        // If call succeeds, send the transaction
        try {
            const tx = await this.contract.methods
                .register()
                .send({ from: account, gas: GAS_LIMITS.register });

            console.log("Registration transaction sent:", tx.transactionHash);

            // Check if UserRegistered event was emitted
            if (tx.events && tx.events.UserRegistered) {
                console.log("UserRegistered event detected");
            }

            // Wait a bit for state to update (Ganache is instant but let's be safe)
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verify registration after transaction
            let attempts = 0;
            let verified = false;
            while (attempts < 10 && !verified) {
                const check = await this.isRegistered(account);
                console.log(`Verification attempt ${attempts + 1}: ${check}`);
                if (check) {
                    verified = true;
                    console.log("Registration verified after transaction");
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 0.5 seconds
                attempts++;
            }

            if (!verified) {
                console.warn(
                    "Registration transaction completed but verification failed after 10 attempts."
                );
                console.warn(
                    "The registration may still be processing. Try checking status manually."
                );
            }

            return tx;
        } catch (error) {
            let errorMessage = error.message;

            if (error.receipt?.status === 0) {
                if (error.data) {
                    try {
                        const decoded = this.contract._decodeMethodReturn(
                            "register",
                            error.data
                        );
                        if (decoded) {
                            errorMessage = `Transaction reverted: ${JSON.stringify(
                                decoded
                            )}`;
                        }
                    } catch (e) {
                        errorMessage = `Transaction reverted: ${this._extractRevertReason(
                            error
                        )}`;
                    }
                } else {
                    const revertReason = this._extractRevertReason(error);
                    errorMessage = revertReason.includes("already")
                        ? "User is already registered"
                        : `Transaction reverted: ${revertReason}`;
                }
            }

            console.error("Registration error details:", error);
            throw new Error(errorMessage);
        }
    }

    /**
     * Check if user is registered
     */
    async isRegistered(address = null) {
        const account = address || web3Service.getAccount();
        if (!account || !this.contract) {
            if (!account)
                console.error("No account available for registration check");
            if (!this.contract) console.error("Contract not loaded");
            return false;
        }

        try {
            const result = await this.contract.methods.users(account).call();
            console.log(
                `Registration check for ${account}:`,
                result,
                typeof result
            );
            return this._toBoolean(result);
        } catch (error) {
            console.error("Error checking registration:", error);
            console.error("Error details:", {
                message: error.message,
                code: error.code,
                data: error.data,
            });
            return false;
        }
    }

    // ==================== Listing Functions ====================

    /**
     * Create listing
     */
    async createListing(
        dailyPriceEth,
        depositEth,
        insuranceDocURI,
        make,
        model,
        year,
        location
    ) {
        const account = web3Service.getAccount();
        const dailyPrice = web3Service.toWei(dailyPriceEth, "ether");
        const deposit = web3Service.toWei(depositEth, "ether");

        const tx = await this.contract.methods
            .createListing(
                dailyPrice,
                deposit,
                insuranceDocURI,
                make,
                model,
                year,
                location
            )
            .send({ from: account, gas: GAS_LIMITS.createListing });

        const listingId = tx.events.ListingCreated.returnValues.listingId;
        return { success: true, listingId: Number(listingId), tx };
    }

    /**
     * Get listing by ID
     */
    async getListing(listingId) {
        const listing = await this.contract.methods.listings(listingId).call();
        return this._parseListing(listing, listingId);
    }

    /**
     * Get all listings
     */
    async getAllListings() {
        const listings = [];
        const maxAttempts = 1000;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const listing = await this.contract.methods.listings(i).call();

                if (!this._isValidListing(listing)) {
                    break;
                }

                listings.push(this._parseListing(listing, i));
            } catch (error) {
                if (i === 0) {
                    console.warn("Error fetching listings:", error);
                }
                break;
            }
        }

        console.log(`Loaded ${listings.length} listing(s) from contract`);
        return listings;
    }

    /**
     * Edit listing
     */
    async editListing(
        listingId,
        dailyPriceEth,
        depositEth,
        insuranceDocURI,
        make,
        model,
        year,
        location
    ) {
        const account = web3Service.getAccount();
        const dailyPrice = web3Service.toWei(dailyPriceEth, "ether");
        const deposit = web3Service.toWei(depositEth, "ether");

        return await this.contract.methods
            .editListing(
                listingId,
                dailyPrice,
                deposit,
                insuranceDocURI,
                make,
                model,
                year,
                location
            )
            .send({ from: account, gas: GAS_LIMITS.editListing });
    }

    /**
     * Set listing active status
     */
    async setListingActive(listingId, active) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .setListingActive(listingId, active)
            .send({ from: account, gas: GAS_LIMITS.setListingActive });
    }

    /**
     * Verify insurance (insurance verifier only)
     */
    async verifyInsurance(listingId, isValid) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .verifyInsurance(listingId, isValid)
            .send({ from: account, gas: GAS_LIMITS.verifyInsurance });
    }

    /**
     * Check if account is insurance verifier
     */
    async isInsuranceVerifier(address = null) {
        const account = address || web3Service.getAccount();
        const verifierAddr = await this.contract.methods
            .insuranceVerifier()
            .call();
        return verifierAddr.toLowerCase() === account.toLowerCase();
    }

    // ==================== Booking Functions ====================

    /**
     * Calculate escrow amount for booking
     */
    calculateEscrow(listing, startDate, endDate) {
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
        const days = Math.floor((endTimestamp - startTimestamp) / 86400);

        if (days < 1) {
            throw new Error("Minimum 1 day required");
        }

        const dailyPriceWei = web3Service.toWei(listing.dailyPrice, "ether");
        const depositWei = web3Service.toWei(listing.deposit, "ether");
        const rentalCost = BigInt(dailyPriceWei) * BigInt(days);
        const escrow = rentalCost + BigInt(depositWei);

        return {
            days,
            rentalCost: rentalCost.toString(),
            escrow: escrow.toString(),
            escrowEth: web3Service.fromWei(escrow.toString(), "ether"),
        };
    }

    /**
     * Request booking
     */
    async requestBooking(listingId, startDate, endDate) {
        const account = web3Service.getAccount();
        // Get listing to calculate escrow
        const listing = await this.getListing(listingId);

        // Validate listing
        if (!listing.insuranceValid) {
            throw new Error("Listing insurance not verified");
        }
        if (!listing.active) {
            throw new Error("Listing is inactive");
        }

        // Calculate escrow
        const { escrow } = this.calculateEscrow(listing, startDate, endDate);

        // Convert dates to timestamps
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

        const tx = await this.contract.methods
            .requestBooking(listingId, startTimestamp, endTimestamp)
            .send({
                from: account,
                value: escrow,
                gas: GAS_LIMITS.requestBooking,
            });

        const bookingId = tx.events.BookingRequested.returnValues.bookingId;
        return { success: true, bookingId: Number(bookingId), tx };
    }

    /**
     * Get booking by ID
     */
    async getBooking(bookingId) {
        const booking = await this.contract.methods.bookings(bookingId).call();
        const listing = await this.getListing(booking.listingId);
        return this._parseBooking(booking, bookingId, listing);
    }

    /**
     * Get bookings for current user
     */
    async getMyBookings() {
        const account = web3Service.getAccount();
        const bookings = [];
        const maxAttempts = 1000;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const booking = await this.contract.methods.bookings(i).call();
                const listing = await this.contract.methods
                    .listings(booking.listingId)
                    .call();

                const isRenter =
                    booking.renter.toLowerCase() === account.toLowerCase();
                const isOwner =
                    (listing.carOwner || listing[0]).toLowerCase() ===
                    account.toLowerCase();

                if (isRenter || isOwner) {
                    const parsedListing = this._parseListing(
                        listing,
                        Number(booking.listingId)
                    );
                    const parsedBooking = this._parseBooking(
                        booking,
                        i,
                        parsedListing
                    );
                    parsedBooking.owner = parsedListing.owner;
                    parsedBooking.isRenter = isRenter;
                    parsedBooking.isOwner = isOwner;
                    bookings.push(parsedBooking);
                }
            } catch (error) {
                break;
            }
        }
        return bookings;
    }

    /**
     * Get all disputed bookings (for arbitrator)
     * BookingStatus.Disputed = 8
     */
    async getDisputedBookings() {
        const bookings = [];
        const seenIds = new Set();
        const maxAttempts = 1000;
        const DISPUTED_STATUS = 8;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const booking = await this.contract.methods.bookings(i).call();

                if (
                    Number(booking.status) === DISPUTED_STATUS &&
                    !seenIds.has(i)
                ) {
                    seenIds.add(i);
                    const listing = await this.contract.methods
                        .listings(booking.listingId)
                        .call();

                    const parsedListing = this._parseListing(
                        listing,
                        Number(booking.listingId)
                    );
                    const parsedBooking = this._parseBooking(booking, i);
                    parsedBooking.owner = parsedListing.owner;
                    parsedBooking.listing = {
                        id: parsedListing.id,
                        make: parsedListing.make,
                        model: parsedListing.model,
                        year: parsedListing.year,
                        location: parsedListing.location,
                    };
                    bookings.push(parsedBooking);
                }
            } catch (error) {
                break;
            }
        }
        return bookings;
    }

    /**
     * Approve booking
     */
    async approveBooking(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .approveBooking(bookingId)
            .send({ from: account, gas: GAS_LIMITS.approveBooking });
    }

    /**
     * Reject booking
     */
    async rejectBooking(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .rejectBooking(bookingId)
            .send({ from: account, gas: GAS_LIMITS.rejectBooking });
    }

    /**
     * Cancel booking (renter only, before active)
     */
    async cancelBooking(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .cancelBeforeActive(bookingId)
            .send({ from: account, gas: GAS_LIMITS.cancelBooking });
    }

    /**
     * Confirm pickup
     */
    async confirmPickup(bookingId, proofURI = "ipfs://pickup") {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .confirmPickup(bookingId, proofURI)
            .send({ from: account, gas: GAS_LIMITS.confirmPickup });
    }

    /**
     * Confirm return
     */
    async confirmReturn(bookingId, proofURI = "ipfs://return") {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .confirmReturn(bookingId, proofURI)
            .send({ from: account, gas: GAS_LIMITS.confirmReturn });
    }

    /**
     * Open dispute
     */
    async openDispute(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .openDispute(bookingId)
            .send({ from: account, gas: GAS_LIMITS.openDispute });
    }

    /**
     * Resolve dispute (arbitrator only)
     */
    async resolveDispute(bookingId, ownerPayoutEth, renterPayoutEth) {
        const account = web3Service.getAccount();
        const ownerPayout = web3Service.toWei(ownerPayoutEth, "ether");
        const renterPayout = web3Service.toWei(renterPayoutEth, "ether");

        return await this.contract.methods
            .resolveDispute(bookingId, ownerPayout, renterPayout)
            .send({ from: account, gas: GAS_LIMITS.resolveDispute });
    }

    /**
     * Check if account is arbitrator
     */
    async isArbitrator(address = null) {
        const account = address || web3Service.getAccount();
        const arbitratorAddr = await this.contract.methods.arbitrator().call();
        return arbitratorAddr.toLowerCase() === account.toLowerCase();
    }

    // ==================== Rating Functions ====================

    /**
     * Validate rating score
     */
    _validateRating(score) {
        if (score < 1 || score > 5) {
            throw new Error("Rating must be between 1 and 5");
        }
    }

    /**
     * Rate owner (renter only)
     */
    async rateOwner(bookingId, score) {
        this._validateRating(score);
        const account = web3Service.getAccount();
        return await this.contract.methods
            .rateOwner(bookingId, score)
            .send({ from: account, gas: GAS_LIMITS.rateOwner });
    }

    /**
     * Rate renter (owner only)
     */
    async rateRenter(bookingId, score) {
        this._validateRating(score);
        const account = web3Service.getAccount();
        return await this.contract.methods
            .rateRenter(bookingId, score)
            .send({ from: account, gas: GAS_LIMITS.rateRenter });
    }

    /**
     * Get ratings for booking
     */
    async getRatings(bookingId) {
        const [ownerRating, renterRating] = await Promise.all([
            this.contract.methods.rateOwnerScore(bookingId).call(),
            this.contract.methods.rateRenterScore(bookingId).call(),
        ]);

        return {
            owner: {
                value: Number(ownerRating.value),
                set: ownerRating.set,
            },
            renter: {
                value: Number(renterRating.value),
                set: renterRating.set,
            },
        };
    }

    // ==================== Funds Functions ====================

    /**
     * Get balance for account (contract balance - funds available to withdraw)
     */
    async getBalance(address = null) {
        if (!this.contract) throw new Error("Contract not loaded");

        const account = address || web3Service.getAccount();
        if (!account) throw new Error("No account available");

        try {
            const balance = await this.contract.methods
                .balances(account)
                .call();
            return web3Service.fromWei(balance, "ether");
        } catch (error) {
            console.error("Error getting contract balance:", error);
            throw new Error(`Failed to get balance: ${error.message}`);
        }
    }

    /**
     * Get wallet ETH balance (actual ETH in the wallet)
     */
    async getWalletBalance(address = null) {
        if (!web3Service.isInitialized())
            throw new Error("Web3 not initialized");

        const account = address || web3Service.getAccount();
        if (!account) throw new Error("No account available");

        try {
            const web3 = web3Service.getWeb3();
            const balance = await web3.eth.getBalance(account);
            return web3Service.fromWei(balance, "ether");
        } catch (error) {
            console.error("Error getting wallet balance:", error);
            throw new Error(`Failed to get wallet balance: ${error.message}`);
        }
    }

    /**
     * Withdraw funds
     */
    async withdraw() {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .withdraw()
            .send({ from: account, gas: GAS_LIMITS.withdraw });
    }
}

// Export singleton instance
export const contractService = new ContractService();
