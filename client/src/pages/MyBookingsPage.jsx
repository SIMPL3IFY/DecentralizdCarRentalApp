import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { useContract } from "../hooks/useContract";
import { useBookings } from "../hooks/useBookings";
import { useUser } from "../hooks/useUser";
import { web3Service } from "../services/web3Service";
import { contractService } from "../services/contractService";
import {
    getStatusName,
    getStatusColor,
    BookingStatus,
    canCancel,
    canOpenDispute,
} from "../constants/bookingStatus";
import { CONTRACT_ADDRESS } from "../constants/config";

/**
 * Check if a booking is pending (needs renter action)
 */
const isRenterPending = (booking) => {
    const statusNum = Number(booking.status);

    // Requested - waiting for owner, can cancel
    if (statusNum === BookingStatus.Requested) {
        return true;
    }

    // Approved - needs pickup confirmation (only renter can confirm pickup)
    if (statusNum === BookingStatus.Approved) {
        return true;
    }

    return false;
};

export const MyBookingsPage = () => {
    const { contract, loadContract, isLoaded } = useContract();
    const {
        bookings,
        loadBookings,
        cancelBooking,
        confirmPickup,
        confirmReturn,
        openDispute,
        isLoading,
    } = useBookings(contract);
    const { isRegistered, isInsuranceVerifier, isArbitrator } =
        useUser(contract);
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

    // Load bookings when contract is available
    useEffect(() => {
        if (contract && !isInitializing && isRegistered) {
            loadBookings();
        }
    }, [contract, loadBookings, isInitializing, isRegistered]);

    // Listen for account changes and reload bookings
    useEffect(() => {
        if (!web3Service.isInitialized()) return;

        const unsubscribe = web3Service.onAccountChange((newAccount) => {
            if (contract && newAccount) {
                console.log("Account changed, reloading bookings...");
                loadBookings();
            }
        });

        return unsubscribe;
    }, [contract, loadBookings]);

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(""), 3000);
    };

    const currentAccount = web3Service.getAccount()?.toLowerCase();

    // Filter bookings for renter
    const renterBookings = bookings.filter((b) => {
        if (!currentAccount) return false;
        return b.isRenter && b.renter?.toLowerCase() === currentAccount;
    });

    // Apply filter
    const filteredBookings =
        filter === "pending"
            ? renterBookings.filter(isRenterPending)
            : renterBookings;

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
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

    if (isInsuranceVerifier || isArbitrator) {
        const role = isInsuranceVerifier ? "Insurance Verifier" : "Arbitrator";
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <p className="text-red-800">
                            You do not have Owner/Renter permissions. This page
                            is only accessible to Owners and Renters.
                        </p>
                        <p className="text-sm text-red-600 mt-2">
                            Your role: {role}
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
                        My Bookings (Renter)
                    </h1>
                    <p className="text-gray-600">
                        View and manage your car rental bookings
                    </p>
                </div>

                {/* Message */}
                {message && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800">{message}</p>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="mb-6 flex space-x-4 border-b border-gray-200">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                            filter === "all"
                                ? "text-purple-600 border-purple-600"
                                : "text-gray-500 border-transparent hover:text-gray-700"
                        }`}
                    >
                        All Bookings ({renterBookings.length})
                    </button>
                    <button
                        onClick={() => setFilter("pending")}
                        className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                            filter === "pending"
                                ? "text-purple-600 border-purple-600"
                                : "text-gray-500 border-transparent hover:text-gray-700"
                        }`}
                    >
                        Pending ({renterBookings.filter(isRenterPending).length}
                        )
                    </button>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
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
                                    : "Start by browsing available cars on the Rent page."}
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
                                                {booking.listing.location}
                                            </p>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-3">
                                            <div>
                                                <p className="text-sm text-gray-600">
                                                    Booking Dates
                                                </p>
                                                <p className="font-semibold text-sm">
                                                    {booking.startDate &&
                                                    booking.endDate
                                                        ? `${booking.startDate.toLocaleDateString()} - ${booking.endDate.toLocaleDateString()}`
                                                        : "N/A"}
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
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
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
                                        {canCancel(booking.status) && (
                                            <button
                                                onClick={async () => {
                                                    if (
                                                        !window.confirm(
                                                            "Are you sure you want to cancel this booking?"
                                                        )
                                                    ) {
                                                        return;
                                                    }
                                                    const result =
                                                        await cancelBooking(
                                                            booking.id
                                                        );
                                                    if (result.success) {
                                                        showMessage(
                                                            `Booking ${booking.id} cancelled`
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
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium"
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </div>
        </div>
    );
};
