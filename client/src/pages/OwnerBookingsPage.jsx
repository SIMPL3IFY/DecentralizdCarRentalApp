import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { useContract } from "../hooks/useContract";
import { useBookings } from "../hooks/useBookings";
import { useListings } from "../hooks/useListings";
import { useUser } from "../hooks/useUser";
import { web3Service } from "../services/web3Service";
import { contractService } from "../services/contractService";
import {
    getStatusName,
    getStatusColor,
    BookingStatus,
    canOpenDispute,
} from "../constants/bookingStatus";
import { CONTRACT_ADDRESS } from "../constants/config";

/**
 * Check if a booking is pending (needs owner action)
 */
const isOwnerPending = (booking) => {
    const statusNum = Number(booking.status);

    // Requested - needs approve/reject
    if (statusNum === BookingStatus.Requested) {
        return true;
    }

    // Approved - needs pickup confirmation
    if (statusNum === BookingStatus.Approved && !booking.ownerPickup) {
        return true;
    }

    // ReturnPending - needs return confirmation
    if (statusNum === BookingStatus.ReturnPending && !booking.ownerReturn) {
        return true;
    }

    return false;
};

export const OwnerBookingsPage = () => {
    const { contract, loadContract, isLoaded } = useContract();
    const {
        bookings,
        loadBookings,
        approveBooking,
        rejectBooking,
        confirmPickup,
        confirmReturn,
        openDispute,
        isLoading,
    } = useBookings(contract);
    const {
        listings,
        loadListings,
        isLoading: listingsLoading,
    } = useListings(contract);
    const { isRegistered } = useUser(contract);
    const [filter, setFilter] = useState("all"); // "all" | "pending"
    const [isInitializing, setIsInitializing] = useState(true);
    const [message, setMessage] = useState("");

    // Initialize contract if needed
    useEffect(() => {
        const initialize = async () => {
            if (!isLoaded) {
                const contractAddressToLoad =
                    CONTRACT_ADDRESS || localStorage.getItem("contractAddress");
                if (contractAddressToLoad) {
                    await loadContract(contractAddressToLoad);
                }
            }
            setIsInitializing(false);
        };
        initialize();
    }, [isLoaded, loadContract]);

    // Load bookings and listings when contract is available
    useEffect(() => {
        if (contract && !isInitializing && isRegistered) {
            loadBookings();
            loadListings();
        }
    }, [contract, loadBookings, loadListings, isInitializing, isRegistered]);

    // Listen for account changes and reload bookings
    useEffect(() => {
        if (!web3Service.isInitialized()) return;

        const unsubscribe = web3Service.onAccountChange((newAccount) => {
            if (contract && newAccount) {
                console.log(
                    "Account changed, reloading bookings and listings..."
                );
                loadBookings();
                loadListings();
            }
        });

        return unsubscribe;
    }, [contract, loadBookings, loadListings]);

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(""), 3000);
    };

    // Filter bookings for owner
    const ownerBookings = bookings.filter((b) => b.isOwner);

    // Apply filter
    const filteredBookings =
        filter === "pending"
            ? ownerBookings.filter(isOwnerPending)
            : ownerBookings;

    // Get owner's listings pending insurance verification
    const currentAccount = web3Service.getAccount()?.toLowerCase();
    const pendingInsuranceListings = listings.filter(
        (listing) =>
            listing.owner?.toLowerCase() === currentAccount &&
            !listing.insuranceValid
    );

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isRegistered) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <p className="text-yellow-800">
                            Please register your account to view bookings.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        My Bookings (Owner)
                    </h1>
                    <p className="text-gray-600">
                        Manage bookings for your listed cars and view listings
                        pending insurance verification
                    </p>
                </div>

                {/* Message */}
                {message && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800">{message}</p>
                    </div>
                )}

                {/* Pending Insurance Verification Section */}
                {pendingInsuranceListings.length > 0 && (
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-900">
                                    Pending Insurance Verification
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    These listings are waiting for insurance
                                    verification before bookings can be made
                                </p>
                            </div>
                            <button
                                onClick={loadListings}
                                disabled={listingsLoading}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                            >
                                {listingsLoading ? "Refreshing..." : "Refresh"}
                            </button>
                        </div>
                        <div className="space-y-4">
                            {pendingInsuranceListings.map((listing) => (
                                <div
                                    key={listing.id}
                                    className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <p className="font-semibold text-lg">
                                                    {listing.make &&
                                                    listing.model
                                                        ? `${listing.make} ${
                                                              listing.model
                                                          }${
                                                              listing.year
                                                                  ? ` (${listing.year})`
                                                                  : ""
                                                          }`
                                                        : `Listing #${listing.id}`}
                                                </p>
                                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                                                    Pending Verification
                                                </span>
                                            </div>
                                            {listing.location && (
                                                <p className="text-sm text-gray-600 mb-3">
                                                    📍 {listing.location}
                                                </p>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                <div>
                                                    <p className="text-sm text-gray-600">
                                                        Daily Price
                                                    </p>
                                                    <p className="font-semibold">
                                                        {listing.dailyPrice} ETH
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">
                                                        Security Deposit
                                                    </p>
                                                    <p className="font-semibold">
                                                        {listing.deposit} ETH
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-4">
                                                Listing ID: {listing.id}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="mb-6 flex space-x-4 border-b border-gray-200">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                            filter === "all"
                                ? "text-indigo-600 border-indigo-600"
                                : "text-gray-500 border-transparent hover:text-gray-700"
                        }`}
                    >
                        All Bookings ({ownerBookings.length})
                    </button>
                    <button
                        onClick={() => setFilter("pending")}
                        className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                            filter === "pending"
                                ? "text-indigo-600 border-indigo-600"
                                : "text-gray-500 border-transparent hover:text-gray-700"
                        }`}
                    >
                        Pending ({ownerBookings.filter(isOwnerPending).length})
                    </button>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading bookings...</p>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && filteredBookings.length === 0 && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <p className="text-xl text-gray-600 mb-2">
                                {filter === "pending"
                                    ? "No pending bookings"
                                    : "No bookings yet"}
                            </p>
                            <p className="text-gray-500">
                                {filter === "pending"
                                    ? "All caught up! No action needed."
                                    : "Bookings will appear here when renters request your cars."}
                            </p>
                        </div>
                    </div>
                )}

                {/* Bookings List */}
                {!isLoading && filteredBookings.length > 0 && (
                    <div className="space-y-4">
                        {filteredBookings.map((booking) => (
                            <div
                                key={booking.id}
                                className="bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <p className="font-semibold text-lg">
                                                Booking #{booking.id}
                                            </p>
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                    booking.status
                                                )}`}
                                            >
                                                {getStatusName(booking.status)}
                                            </span>
                                        </div>

                                        {booking.listing ? (
                                            <p className="text-xl font-medium mb-2">
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
                                            <p className="text-lg mb-2">
                                                Listing: #{booking.listingId}
                                            </p>
                                        )}

                                        {booking.listing?.location && (
                                            <p className="text-sm text-gray-600 mb-3">
                                                📍 {booking.listing.location}
                                            </p>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <p className="text-sm text-gray-600">
                                                    Renter
                                                </p>
                                                <p className="font-mono text-sm">
                                                    {booking.renter?.slice(
                                                        0,
                                                        10
                                                    )}
                                                    ...
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">
                                                    Rental Cost
                                                </p>
                                                <p className="font-semibold">
                                                    {booking.rentalCost} ETH
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">
                                                    Deposit
                                                </p>
                                                <p className="font-semibold">
                                                    {booking.deposit} ETH
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 ml-6">
                                        {booking.status ===
                                            BookingStatus.Requested && (
                                            <>
                                                <button
                                                    onClick={async () => {
                                                        const result =
                                                            await approveBooking(
                                                                booking.id
                                                            );
                                                        if (result.success) {
                                                            showMessage(
                                                                `Booking ${booking.id} approved`
                                                            );
                                                            await loadBookings();
                                                        } else {
                                                            showMessage(
                                                                `Error: ${result.error}`
                                                            );
                                                        }
                                                    }}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const result =
                                                            await rejectBooking(
                                                                booking.id
                                                            );
                                                        if (result.success) {
                                                            showMessage(
                                                                `Booking ${booking.id} rejected`
                                                            );
                                                            await loadBookings();
                                                        } else {
                                                            showMessage(
                                                                `Error: ${result.error}`
                                                            );
                                                        }
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {booking.status ===
                                            BookingStatus.Approved &&
                                            !booking.ownerPickup && (
                                                <button
                                                    onClick={async () => {
                                                        const result =
                                                            await confirmPickup(
                                                                booking.id
                                                            );
                                                        if (result.success) {
                                                            showMessage(
                                                                "Pickup confirmed"
                                                            );
                                                            await loadBookings();
                                                        } else {
                                                            showMessage(
                                                                `Error: ${result.error}`
                                                            );
                                                        }
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                                                >
                                                    Confirm Pickup
                                                </button>
                                            )}
                                        {(booking.status ===
                                            BookingStatus.Active ||
                                            booking.status ===
                                                BookingStatus.ReturnPending) &&
                                            !booking.ownerReturn && (
                                                <button
                                                    onClick={async () => {
                                                        const result =
                                                            await confirmReturn(
                                                                booking.id
                                                            );
                                                        if (result.success) {
                                                            showMessage(
                                                                "Return confirmed"
                                                            );
                                                            await loadBookings();
                                                        } else {
                                                            showMessage(
                                                                `Error: ${result.error}`
                                                            );
                                                        }
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
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
                                                        if (result.success) {
                                                            showMessage(
                                                                `Dispute opened for booking ${booking.id}`
                                                            );
                                                            await loadBookings();
                                                        } else {
                                                            showMessage(
                                                                `Error: ${result.error}`
                                                            );
                                                        }
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
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

                {/* Refresh Button */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={loadBookings}
                        disabled={isLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium"
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </div>
        </div>
    );
};
