import React, { useState, useEffect } from "react";
import { useListings } from "../hooks/useListings";
import { useBookings } from "../hooks/useBookings";
import { useUser } from "../hooks/useUser";
import { contractService } from "../services/contractService";
import { web3Service } from "../services/web3Service";
import { InsuranceStatus } from "../constants/insuranceStatus";
import {
    getStatusName,
    getStatusColor,
    BookingStatus,
    canOpenDispute,
} from "../constants/bookingStatus";

export const OwnerDashboard = ({ contract, log }) => {
    const {
        listings,
        isLoading: listingsLoading,
        loadListings,
        createListing,
        verifyInsurance,
    } = useListings(contract);
    const {
        bookings,
        loadBookings,
        approveBooking,
        rejectBooking,
        confirmPickup,
        confirmReturn,
        openDispute,
    } = useBookings(contract);
    const { balance, walletBalance, isInsuranceVerifier } = useUser(contract);
    const [newListing, setNewListing] = useState({
        dailyPrice: "",
        deposit: "",
        insuranceDocURI: "ipfs://insurance.pdf",
        make: "",
        model: "",
        year: "",
        location: "",
    });
    const [withdrawing, setWithdrawing] = useState(false);

    useEffect(() => {
        if (contract) {
            loadListings();
            loadBookings();
        }
    }, [contract, loadListings, loadBookings]);

    const handleCreateListing = async (e) => {
        e.preventDefault();
        if (
            !newListing.dailyPrice ||
            !newListing.deposit ||
            !newListing.make ||
            !newListing.model ||
            !newListing.year ||
            !newListing.location
        ) {
            log("Fill all fields");
            return;
        }

        log("Creating listing...");
        const result = await createListing(
            newListing.dailyPrice,
            newListing.deposit,
            newListing.insuranceDocURI,
            newListing.make,
            newListing.model,
            Number(newListing.year),
            newListing.location
        );

        if (result.success) {
            log(`Listing created: ${result.listingId}`);
            setNewListing({
                dailyPrice: "",
                deposit: "",
                insuranceDocURI: "ipfs://insurance.pdf",
                make: "",
                model: "",
                year: "",
                location: "",
            });
        } else {
            log(`Error: ${result.error}`);
        }
    };

    const handleVerifyInsurance = async (listingId, isValid) => {
        if (!isInsuranceVerifier) {
            log("Only insurance verifier can verify");
            return;
        }

        log(`Verifying listing ${listingId}...`);
        const result = await verifyInsurance(listingId, isValid);
        if (result.success) {
            log(`Insurance ${isValid ? "verified" : "rejected"}`);
        } else {
            log(`Error: ${result.error}`);
        }
    };

    const handleWithdraw = async () => {
        setWithdrawing(true);
        log("Withdrawing...");
        try {
            await contractService.withdraw();
            log("Withdrawn");
            window.location.reload();
        } catch (error) {
            log(`Error: ${error.message}`);
        } finally {
            setWithdrawing(false);
        }
    };

    const ownerBookings = bookings.filter((b) => b.isOwner);
    const currentAccount = web3Service.getAccount()?.toLowerCase();
    const myListings = listings.filter(
        (listing) => listing.owner?.toLowerCase() === currentAccount
    );

    return (
        <div className="space-y-6">
            <div className="bg-indigo-50 p-4 rounded-lg">
                <h3 className="font-semibold text-indigo-800 mb-2">
                    Owner Info
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
                <h3 className="text-xl font-semibold mb-4">Create Listing</h3>
                <form onSubmit={handleCreateListing} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-700">
                                Car Information
                            </h4>
                            <input
                                type="text"
                                placeholder="Make (e.g., Toyota)"
                                value={newListing.make}
                                onChange={(e) =>
                                    setNewListing({
                                        ...newListing,
                                        make: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Model (e.g., Camry)"
                                value={newListing.model}
                                onChange={(e) =>
                                    setNewListing({
                                        ...newListing,
                                        model: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                                required
                            />
                            <input
                                type="number"
                                placeholder="Year (e.g., 2020)"
                                value={newListing.year}
                                onChange={(e) =>
                                    setNewListing({
                                        ...newListing,
                                        year: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                                min="1900"
                                max="2100"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Location (e.g., New York, NY)"
                                value={newListing.location}
                                onChange={(e) =>
                                    setNewListing({
                                        ...newListing,
                                        location: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                                required
                            />
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-700">
                                Pricing & Insurance
                            </h4>
                            <input
                                type="text"
                                placeholder="Daily Price (ETH)"
                                value={newListing.dailyPrice}
                                onChange={(e) =>
                                    setNewListing({
                                        ...newListing,
                                        dailyPrice: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Security Deposit (ETH)"
                                value={newListing.deposit}
                                onChange={(e) =>
                                    setNewListing({
                                        ...newListing,
                                        deposit: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Insurance Doc URI"
                                value={newListing.insuranceDocURI}
                                onChange={(e) =>
                                    setNewListing({
                                        ...newListing,
                                        insuranceDocURI: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={listingsLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg"
                    >
                        {listingsLoading ? "Creating..." : "Create Listing"}
                    </button>
                </form>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">My Listings</h3>
                    <button
                        onClick={loadListings}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Refresh
                    </button>
                </div>
                {myListings.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        No listings yet for this account
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myListings.map((listing) => (
                            <div
                                key={listing.id}
                                className="border rounded-lg p-4 bg-gray-50"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-lg">
                                            {listing.make && listing.model
                                                ? `${listing.make} ${
                                                      listing.model
                                                  }${
                                                      listing.year
                                                          ? ` (${listing.year})`
                                                          : ""
                                                  }`
                                                : `Listing #${listing.id}`}
                                        </p>
                                        {listing.location && (
                                            <p className="text-sm text-gray-600">
                                                {listing.location}
                                            </p>
                                        )}
                                        <p className="mt-2">
                                            Daily Price: {listing.dailyPrice}{" "}
                                            ETH
                                        </p>
                                        <p>Deposit: {listing.deposit} ETH</p>
                                        <div className="flex gap-2 mt-2">
                                            {listing.active ? (
                                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                                    Inactive
                                                </span>
                                            )}
                                            {listing.insuranceStatus ===
                                            InsuranceStatus.Approved ? (
                                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                                    Insurance Approved
                                                </span>
                                            ) : listing.insuranceStatus ===
                                              InsuranceStatus.Rejected ? (
                                                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                                    Insurance Rejected
                                                </span>
                                            ) : (
                                                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                                                    Insurance Pending
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Listing ID: {listing.id}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">My Bookings</h3>
                    <button
                        onClick={loadBookings}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Refresh
                    </button>
                </div>
                {ownerBookings.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        No bookings yet
                    </div>
                ) : (
                    <div className="space-y-4">
                        {ownerBookings.map((booking) => (
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
                                            Renter:
                                            {booking.renter}
                                        </p>
                                        <p>
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
                                        {booking.status ===
                                            BookingStatus.Requested && (
                                            <>
                                                <button
                                                    onClick={async () => {
                                                        const result =
                                                            await approveBooking(
                                                                booking.id
                                                            );
                                                        if (result.success)
                                                            log(
                                                                `Booking ${booking.id} approved`
                                                            );
                                                    }}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const result =
                                                            await rejectBooking(
                                                                booking.id
                                                            );
                                                        if (result.success)
                                                            log(
                                                                `Booking ${booking.id} rejected`
                                                            );
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {booking.status ===
                                            BookingStatus.Active && (
                                            <button
                                                onClick={async () => {
                                                    const result =
                                                        await confirmReturn(
                                                            booking.id
                                                        );
                                                    if (result.success)
                                                        log(`Return confirmed`);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                                            >
                                                Confirm Return
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
