import { web3Service } from "./web3Service";
import { CONTRACT_ABI_PATH, GAS_LIMITS } from "../constants/config";
import { BookingStatus } from "../constants/bookingStatus";
import { InsuranceStatus } from "../constants/insuranceStatus";

class ContractService {
    constructor() {
        this.contract = null;
        this.contractAddress = null;
    }

    async loadContract(contractAddress) {
        try {
            const web3 = web3Service.getWeb3();
            if (!web3) {
                throw new Error("Web3 not initialized");
            }

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

    getContract() {
        return this.contract;
    }

    getContractAddress() {
        return this.contractAddress;
    }

    isLoaded() {
        return this.contract !== null;
    }

    _parseListing(listing, listingId) {
        const owner = listing.carOwner || listing[0];
        const dailyPrice = listing.dailyPrice || listing[1];
        const deposit = listing.securityDeposit || listing[2];
        const active =
            listing.active !== undefined ? listing.active : listing[3];
        const insuranceStatus =
            listing.insuranceStatus !== undefined
                ? Number(listing.insuranceStatus)
                : listing[4] !== undefined
                ? Number(listing[4])
                : InsuranceStatus.Pending;
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
            insuranceStatus: insuranceStatus,
            insuranceValid: insuranceStatus === InsuranceStatus.Approved,
            insuranceDocURI,
            make,
            model,
            year,
            location,
        };
    }

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
            renterPickup: booking.renterPickup || false,
            ownerReturn: booking.ownerReturn || false,
        };

        if (listing) {
            baseBooking.listing = listing;
        }

        if (booking.pickupProofURI_renter !== undefined) {
            baseBooking.pickupProofURI_renter = booking.pickupProofURI_renter;
        }
        if (booking.returnProofURI_owner !== undefined) {
            baseBooking.returnProofURI_owner = booking.returnProofURI_owner;
        }

        return baseBooking;
    }

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

    async register() {
        const account = web3Service.getAccount();
        const web3 = web3Service.getWeb3();

        const alreadyRegistered = await this.isRegistered(account);
        if (alreadyRegistered) {
            throw new Error("User is already registered");
        }

        try {
            await this.contract.methods.register().call({ from: account });
        } catch (callError) {
            const revertReason = this._extractRevertReason(callError);
            throw new Error(`Transaction will revert: ${revertReason}`);
        }

        try {
            const tx = await this.contract.methods
                .register()
                .send({ from: account, gas: GAS_LIMITS.register });

            await new Promise((resolve) => setTimeout(resolve, 2000));

            let attempts = 0;
            let verified = false;
            while (attempts < 10 && !verified) {
                const check = await this.isRegistered(account);
                if (check) {
                    verified = true;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
                attempts++;
            }

            if (!verified) {
                console.warn(
                    "Registration transaction completed but verification failed after 10 attempts. The registration may still be processing."
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

            throw new Error(errorMessage);
        }
    }

    async isRegistered(address = null) {
        const account = address || web3Service.getAccount();
        if (!account || !this.contract) {
            return false;
        }

        try {
            const result = await this.contract.methods.users(account).call();
            return this._toBoolean(result);
        } catch (error) {
            console.error("Error checking registration:", error);
            return false;
        }
    }

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

    async getListing(listingId) {
        const listing = await this.contract.methods.listings(listingId).call();
        return this._parseListing(listing, listingId);
    }

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
                break;
            }
        }

        return listings;
    }

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

        try {
            const tx = await this.contract.methods
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
            return { success: true, tx };
        } catch (error) {
            const errorMessage = this._extractRevertReason(error);
            return { success: false, error: errorMessage };
        }
    }

    async setListingActive(listingId, active) {
        const account = web3Service.getAccount();
        try {
            const tx = await this.contract.methods
                .setListingActive(listingId, active)
                .send({ from: account, gas: GAS_LIMITS.setListingActive });
            return { success: true, tx };
        } catch (error) {
            const errorMessage = this._extractRevertReason(error);
            return { success: false, error: errorMessage };
        }
    }

    async verifyInsurance(listingId, isValid) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .verifyInsurance(listingId, isValid)
            .send({ from: account, gas: GAS_LIMITS.verifyInsurance });
    }

    async isInsuranceVerifier(address = null) {
        const account = address || web3Service.getAccount();
        const verifierAddr = await this.contract.methods
            .insuranceVerifier()
            .call();
        return verifierAddr.toLowerCase() === account.toLowerCase();
    }

    _dateToTimestamp(dateString) {
        const [year, month, day] = dateString.split("-").map(Number);
        const date = new Date(year, month - 1, day, 0, 0, 0, 0);
        const timestamp = Math.floor(date.getTime() / 1000);

        return timestamp;
    }

    calculateEscrow(listing, startDate, endDate) {
        const startTimestamp = this._dateToTimestamp(startDate);
        const endTimestamp = this._dateToTimestamp(endDate);
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

    async requestBooking(listingId, startDate, endDate) {
        const account = web3Service.getAccount();
        const web3 = web3Service.getWeb3();

        const listing = await this.getListing(listingId);

        if (listing.insuranceStatus !== InsuranceStatus.Approved) {
            throw new Error("Listing insurance not approved");
        }
        if (!listing.active) {
            throw new Error("Listing is inactive");
        }

        const startTimestamp = this._dateToTimestamp(startDate);
        const endTimestamp = this._dateToTimestamp(endDate);

        const latestBlock = await web3.eth.getBlock("latest");
        const currentTimestamp = Number(latestBlock.timestamp);

        const bufferSeconds = 120;
        if (startTimestamp < currentTimestamp + bufferSeconds) {
            const selectedDate = new Date(startTimestamp * 1000).toISOString();
            const currentDate = new Date(currentTimestamp * 1000).toISOString();
            const hoursAhead = (
                (currentTimestamp + bufferSeconds - startTimestamp) /
                3600
            ).toFixed(2);
            throw new Error(
                `Start date must be in the future. ` +
                    `Selected date: ${selectedDate}, ` +
                    `Current time: ${currentDate}. ` +
                    `The selected date is ${hoursAhead} hours in the past. ` +
                    `Please select a date that is at least 2 minutes in the future.`
            );
        }

        const { escrow } = this.calculateEscrow(listing, startDate, endDate);

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

    async getBooking(bookingId) {
        const booking = await this.contract.methods.bookings(bookingId).call();
        const listing = await this.getListing(booking.listingId);
        return this._parseBooking(booking, bookingId, listing);
    }

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

                const parsedListing = this._parseListing(
                    listing,
                    Number(booking.listingId)
                );

                const isRenter =
                    booking.renter.toLowerCase() === account.toLowerCase();
                const isOwner =
                    parsedListing.owner.toLowerCase() === account.toLowerCase();

                if (isRenter || isOwner) {
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

    async getDisputedBookings() {
        const bookings = [];
        const seenIds = new Set();
        const maxAttempts = 1000;
        const DISPUTED_STATUS = BookingStatus.Disputed;

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

    async approveBooking(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .approveBooking(bookingId)
            .send({ from: account, gas: GAS_LIMITS.approveBooking });
    }

    async rejectBooking(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .rejectBooking(bookingId)
            .send({ from: account, gas: GAS_LIMITS.rejectBooking });
    }

    async cancelBooking(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .cancelBeforeActive(bookingId)
            .send({ from: account, gas: GAS_LIMITS.cancelBooking });
    }

    async confirmPickup(bookingId, proofURI = "ipfs://pickup") {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .confirmPickup(bookingId, proofURI)
            .send({ from: account, gas: GAS_LIMITS.confirmPickup });
    }

    async confirmReturn(bookingId, proofURI = "ipfs://return") {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .confirmReturn(bookingId, proofURI)
            .send({ from: account, gas: GAS_LIMITS.confirmReturn });
    }

    async openDispute(bookingId) {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .openDispute(bookingId)
            .send({ from: account, gas: GAS_LIMITS.openDispute });
    }

    async resolveDispute(bookingId, ownerPayoutEth, renterPayoutEth) {
        const account = web3Service.getAccount();
        const ownerPayout = web3Service.toWei(ownerPayoutEth, "ether");
        const renterPayout = web3Service.toWei(renterPayoutEth, "ether");

        return await this.contract.methods
            .resolveDispute(bookingId, ownerPayout, renterPayout)
            .send({ from: account, gas: GAS_LIMITS.resolveDispute });
    }

    async isArbitrator(address = null) {
        const account = address || web3Service.getAccount();
        const arbitratorAddr = await this.contract.methods.arbitrator().call();
        return arbitratorAddr.toLowerCase() === account.toLowerCase();
    }

    _validateRating(score) {
        if (score < 1 || score > 5) {
            throw new Error("Rating must be between 1 and 5");
        }
    }

    async rateOwner(bookingId, score) {
        this._validateRating(score);
        const account = web3Service.getAccount();
        return await this.contract.methods
            .rateOwner(bookingId, score)
            .send({ from: account, gas: GAS_LIMITS.rateOwner });
    }

    async rateRenter(bookingId, score) {
        this._validateRating(score);
        const account = web3Service.getAccount();
        return await this.contract.methods
            .rateRenter(bookingId, score)
            .send({ from: account, gas: GAS_LIMITS.rateRenter });
    }

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

    async withdraw() {
        const account = web3Service.getAccount();
        return await this.contract.methods
            .withdraw()
            .send({ from: account, gas: GAS_LIMITS.withdraw });
    }
}

export const contractService = new ContractService();
