import React, { useState, useEffect } from "react";
import { useListings } from "../hooks/useListings";
import { useBookings } from "../hooks/useBookings";
import { useUser } from "../hooks/useUser";
import { contractService } from "../services/contractService";
import { web3Service } from "../services/web3Service";
import {
    getStatusName,
    getStatusColor,
    BookingStatus,
    canCancel,
    canOpenDispute,
} from "../constants/bookingStatus";

export const RenterDashboard = ({ contract, log }) => {
    const { listings, loadListings } = useListings(contract);
    const {
        bookings,
        loadBookings,
        requestBooking,
        cancelBooking,
        confirmPickup,
        confirmReturn,
        openDispute,
    } = useBookings(contract);
    const { balance, walletBalance, isInsuranceVerifier } = useUser(contract);
    const [bookingForm, setBookingForm] = useState({
        listingId: "",
        startDate: "",
        endDate: "",
    });
    const [escrowAmount, setEscrowAmount] = useState(null);
    const [withdrawing, setWithdrawing] = useState(false);

    useEffect(() => {
        if (contract) {
            loadListings();
            loadBookings();
        }
    }, [contract, loadListings, loadBookings]);

    // Track account to reload bookings when it changes
    const [trackedAccount, setTrackedAccount] = useState(
        web3Service.getAccount()
    );

    useEffect(() => {
        const account = web3Service.getAccount();
        if (account !== trackedAccount) {
            setTrackedAccount(account);
            if (contract && account) {
                loadBookings();
            }
        }
    }, [contract, trackedAccount, loadBookings]);

    // Calculate escrow when form changes
    useEffect(() => {
        const calculateEscrow = async () => {
            if (
                !bookingForm.listingId ||
                !bookingForm.startDate ||
                !bookingForm.endDate
            ) {
                setEscrowAmount(null);
                return;
            }

            try {
                const listing = await contractService.getListing(
                    Number(bookingForm.listingId)
                );
                const escrow = contractService.calculateEscrow(
                    listing,
                    bookingForm.startDate,
                    bookingForm.endDate
                );
                setEscrowAmount(escrow);
            } catch (error) {
                setEscrowAmount(null);
            }
        };

        calculateEscrow();
    }, [bookingForm]);

    const handleRequestBooking = async (e) => {
        e.preventDefault();
        if (
            !bookingForm.listingId ||
            !bookingForm.startDate ||
            !bookingForm.endDate
        ) {
            log("Please fill all fields");
            return;
        }

        log("Requesting booking...");
        const result = await requestBooking(
            Number(bookingForm.listingId),
            bookingForm.startDate,
            bookingForm.endDate
        );

        if (result.success) {
            log(`Booking requested: ID ${result.bookingId}`);
            setBookingForm({ listingId: "", startDate: "", endDate: "" });
            setEscrowAmount(null);
        } else {
            log(`Error: ${result.error}`);
        }
    };

    const handleWithdraw = async () => {
        setWithdrawing(true);
        log("Withdrawing funds...");
        try {
            await contractService.withdraw();
            log("Funds withdrawn successfully");
            window.location.reload();
        } catch (error) {
            log(`Withdraw error: ${error.message}`);
        } finally {
            setWithdrawing(false);
        }
    };

    const currentAccount = web3Service.getAccount()?.toLowerCase();

    // Show all active, verified listings (including own listings),
    // and optionally highlight or note if the listing is owned by the current account.
    const availableListings = listings.filter(
        (l) => l.active && l.insuranceValid
    );

    // Filter bookings to only show those for the current account
    const renterBookings = bookings.filter((b) => {
        if (!currentAccount) return false;
        return b.isRenter && b.renter?.toLowerCase() === currentAccount;
    });

    return (
        <div className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">
                    Renter Info
                </h3>
                <p>Wallet Balance: {walletBalance} ETH</p>
                <p>Contract Balance (Available to Withdraw): {balance} ETH</p>
                {parseFloat(balance) > 0 && (
                    <button
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                        className="mt-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg"
                    >
                        {withdrawing ? "Withdrawing..." : "Withdraw Funds"}
                    </button>
                )}
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">
                        Available Listings
                    </h3>
                    <button
                        onClick={loadListings}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Refresh
                    </button>
                </div>
                {availableListings.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        No available listings
                    </div>
                ) : (
                    <div className="space-y-4">
                        {availableListings.map((listing) => (
                            <div
                                key={listing.id}
                                className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <p className="font-semibold text-lg">
                                    {listing.make && listing.model
                                        ? `${listing.make} ${listing.model}${
                                              listing.year
                                                  ? ` (${listing.year})`
                                                  : ""
                                          }`
                                        : `Listing #${listing.id}`}
                                </p>
                                {listing.location && (
                                    <p className="text-sm text-gray-600 mb-2">
                                        {listing.location}
                                    </p>
                                )}
                                <p>Daily Price: {listing.dailyPrice} ETH</p>
                                <p>Security Deposit: {listing.deposit} ETH</p>
                                <p className="text-xs text-gray-500 mt-2">
                                    Listing ID: {listing.id}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-xl font-semibold mb-4">Book a Car</h3>
                <form onSubmit={handleRequestBooking} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="number"
                            placeholder="Listing ID"
                            value={bookingForm.listingId}
                            onChange={(e) =>
                                setBookingForm({
                                    ...bookingForm,
                                    listingId: e.target.value,
                                })
                            }
                            className="border border-gray-300 rounded-lg px-4 py-2"
                        />
                        <input
                            type="date"
                            value={bookingForm.startDate}
                            onChange={(e) =>
                                setBookingForm({
                                    ...bookingForm,
                                    startDate: e.target.value,
                                })
                            }
                            className="border border-gray-300 rounded-lg px-4 py-2"
                        />
                        <input
                            type="date"
                            value={bookingForm.endDate}
                            onChange={(e) =>
                                setBookingForm({
                                    ...bookingForm,
                                    endDate: e.target.value,
                                })
                            }
                            className="border border-gray-300 rounded-lg px-4 py-2"
                        />
                    </div>
                    {escrowAmount && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Escrow Required:</strong>{" "}
                                {escrowAmount.escrowEth} ETH
                                <br />
                                <span className="text-xs">
                                    ({escrowAmount.days} day
                                    {escrowAmount.days > 1 ? "s" : ""} rental +
                                    deposit)
                                </span>
                            </p>
                        </div>
                    )}
                    <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg"
                    >
                        Request Booking
                    </button>
                </form>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">My Bookings</h3>
                    <button
                        onClick={loadBookings}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Refresh
                    </button>
                </div>
                {renterBookings.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        No bookings yet for this account
                    </div>
                ) : (
                    <div className="space-y-4">
                        {renterBookings.map((booking) => (
                            <div
                                key={booking.id}
                                className="border rounded-lg p-4 bg-gray-50"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">
                                            Booking #{booking.id}
                                        </p>
                                        {booking.listing ? (
                                            <p className="text-lg font-medium mt-1">
                                                {booking.listing.make &&
                                                booking.listing.model
                                                    ? `${
                                                          booking.listing.make
                                                      } ${
                                                          booking.listing.model
                                                      }${
                                                          booking.listing.year
                                                              ? ` (${booking.listing.year})`
                                                              : ""
                                                      }`
                                                    : `Listing #${booking.listingId}`}
                                            </p>
                                        ) : (
                                            <p>Listing: #{booking.listingId}</p>
                                        )}
                                        {booking.listing?.location && (
                                            <p className="text-sm text-gray-600">
                                                {booking.listing.location}
                                            </p>
                                        )}
                                        <p className="mt-2">
                                            Status:{" "}
                                            <span
                                                className={getStatusColor(
                                                    booking.status
                                                )}
                                            >
                                                {getStatusName(booking.status)}
                                            </span>
                                        </p>
                                        <p>
                                            Rental Cost: {booking.rentalCost}{" "}
                                            ETH
                                        </p>
                                        <p>Deposit: {booking.deposit} ETH</p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Listing ID: {booking.listingId}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {canCancel(booking.status) && (
                                            <button
                                                onClick={async () => {
                                                    const result =
                                                        await cancelBooking(
                                                            booking.id
                                                        );
                                                    if (result.success)
                                                        log(
                                                            `Booking ${booking.id} cancelled`
                                                        );
                                                }}
                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        {booking.status ===
                                            BookingStatus.Approved && (
                                            <button
                                                onClick={async () => {
                                                    const result =
                                                        await confirmPickup(
                                                            booking.id
                                                        );
                                                    if (result.success)
                                                        log(`Pickup confirmed`);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                                            >
                                                Confirm Pickup
                                            </button>
                                        )}
                                        {canOpenDispute(booking.status) &&
                                            booking.status !==
                                                BookingStatus.Disputed && (
                                                <button
                                                    onClick={async () => {
                                                        if (
                                                            !window.confirm(
                                                                "Are you sure you want to open a dispute? This will require an arbitrator to resolve."
                                                            )
                                                        ) {
                                                            return;
                                                        }
                                                        const result =
                                                            await openDispute(
                                                                booking.id
                                                            );
                                                        if (result.success)
                                                            log(
                                                                `Dispute opened for booking ${booking.id}`
                                                            );
                                                        else
                                                            log(
                                                                `Error: ${result.error}`
                                                            );
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                                                >
                                                    Open Dispute
                                                </button>
                                            )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
