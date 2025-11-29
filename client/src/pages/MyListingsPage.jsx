import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { useContract } from "../hooks/useContract";
import { useBookings } from "../hooks/useBookings";
import { useListings } from "../hooks/useListings";
import { useUser } from "../hooks/useUser";
import { web3Service } from "../services/web3Service";
import { contractService } from "../services/contractService";
import { ipfsService } from "../services/ipfsService";
import { IPFSViewer } from "../components/IPFSViewer";
import { InsuranceStatus } from "../constants/insuranceStatus";
import {
    getStatusName,
    getStatusColor,
    BookingStatus,
    canOpenDispute,
} from "../constants/bookingStatus";
import { CONTRACT_ADDRESS } from "../constants/config";

const isOwnerPending = (booking) => {
    const statusNum = Number(booking.status);

    if (statusNum === BookingStatus.Requested) {
        return true;
    }

    if (statusNum === BookingStatus.Active) {
        return true;
    }

    return false;
};

export const MyListingsPage = () => {
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
    const { isRegistered, isInsuranceVerifier, isArbitrator } =
        useUser(contract);
    const [filter, setFilter] = useState("all"); // "all" | "pending"
    const [isInitializing, setIsInitializing] = useState(true);
    const [message, setMessage] = useState("");
    const [returnFiles, setReturnFiles] = useState({});
    const [uploadingReturn, setUploadingReturn] = useState({});

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

    const handleReturnFileChange = async (bookingId, e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!ipfsService.validateFileType(file, allowedTypes)) {
            alert('Please upload a PDF or image file (PDF, JPG, PNG)');
            return;
        }

        // Validate file size (max 10MB)
        if (!ipfsService.validateFileSize(file, 10)) {
            alert('File size must be less than 10MB');
            return;
        }

        setReturnFiles(prev => ({ ...prev, [bookingId]: file }));
        setUploadingReturn(prev => ({ ...prev, [bookingId]: true }));

        try {
            // Upload to IPFS
            const ipfsURI = await ipfsService.uploadFile(file);
            
            // Confirm return with IPFS URI
            const result = await confirmReturn(bookingId, ipfsURI);
            if (result.success) {
                showMessage("Return confirmed with proof document");
                await loadBookings();
            } else {
                showMessage(`Error: ${result.error}`);
            }
        } catch (error) {
            showMessage(`Upload failed: ${error.message}`);
        } finally {
            setUploadingReturn(prev => ({ ...prev, [bookingId]: false }));
        }
    };

    // Get current account
    const currentAccount = web3Service.getAccount()?.toLowerCase();

    // Filter bookings for owner
    const ownerBookings = bookings.filter((b) => b.isOwner);

    // Get all owner's listings
    const ownerListings = listings.filter(
        (listing) => listing.owner?.toLowerCase() === currentAccount
    );

    // Group bookings by listing ID
    const bookingsByListing = {};
    ownerBookings.forEach((booking) => {
        const listingId = Number(booking.listingId);
        if (!bookingsByListing[listingId]) {
            bookingsByListing[listingId] = [];
        }
        bookingsByListing[listingId].push(booking);
    });

    // Enrich listings with their bookings and status
    const listingsWithBookings = ownerListings.map((listing) => {
        const listingBookings = bookingsByListing[listing.id] || [];
        const hasPendingBookings = listingBookings.some(isOwnerPending);

        return {
            ...listing,
            bookings: listingBookings,
            hasPendingBookings,
            bookingCount: listingBookings.length,
        };
    });

    // Categorize listings
    const pendingInsuranceListings = listingsWithBookings.filter(
        (listing) => listing.insuranceStatus === InsuranceStatus.Pending
    );

    const verifiedListings = listingsWithBookings.filter(
        (listing) =>
            listing.insuranceStatus === InsuranceStatus.Approved &&
            listing.active
    );

    const rejectedInsuranceListings = listingsWithBookings.filter(
        (listing) => listing.insuranceStatus === InsuranceStatus.Rejected
    );

    // Apply filter to listings
    const filteredListings =
        filter === "pending"
            ? verifiedListings.filter((listing) => listing.hasPendingBookings)
            : verifiedListings;

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
                            Please register your account to view listings.
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
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        My Listings
                    </h1>
                    <p className="text-gray-600">
                        Manage your car listings and their bookings
                    </p>
                </div>

                {message && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800">{message}</p>
                    </div>
                )}

                <div className="mb-6 flex justify-end">
                    <button
                        onClick={() => {
                            loadListings();
                            loadBookings();
                        }}
                        disabled={isLoading || listingsLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium"
                    >
                        {isLoading || listingsLoading
                            ? "Refreshing..."
                            : "Refresh All"}
                    </button>
                </div>

                {pendingInsuranceListings.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                            Pending Insurance Verification
                        </h2>
                        <div className="space-y-4">
                            {pendingInsuranceListings.map((listing) => (
                                <div
                                    key={listing.id}
                                    className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6"
                                >
                                    <div className="flex items-center gap-3 mb-3">
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
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                                            Pending Verification
                                        </span>
                                    </div>
                                    {listing.location && (
                                        <p className="text-sm text-gray-600 mb-3">
                                            {listing.location}
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
                            ))}
                        </div>
                    </div>
                )}

                {rejectedInsuranceListings.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                            Rejected Insurance Verification
                        </h2>
                        <div className="space-y-4">
                            {rejectedInsuranceListings.map((listing) => (
                                <div
                                    key={listing.id}
                                    className="bg-red-50 border-2 border-red-300 rounded-lg p-6"
                                >
                                    <div className="flex items-center gap-3 mb-3">
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
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                                            Insurance Rejected
                                        </span>
                                    </div>
                                    {listing.location && (
                                        <p className="text-sm text-gray-600 mb-3">
                                            �� {listing.location}
                                        </p>
                                    )}
                                    <p className="text-sm text-red-700 mb-3">
                                        Your insurance verification was
                                        rejected. Please update your insurance
                                        documentation and contact the verifier
                                        for re-verification.
                                    </p>
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
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-6 flex space-x-4 border-b border-gray-200">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                            filter === "all"
                                ? "text-indigo-600 border-indigo-600"
                                : "text-gray-500 border-transparent hover:text-gray-700"
                        }`}
                    >
                        All Listings ({verifiedListings.length})
                    </button>
                    <button
                        onClick={() => setFilter("pending")}
                        className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                            filter === "pending"
                                ? "text-indigo-600 border-indigo-600"
                                : "text-gray-500 border-transparent hover:text-gray-700"
                        }`}
                    >
                        With Pending Bookings (
                        {
                            verifiedListings.filter((l) => l.hasPendingBookings)
                                .length
                        }
                        )
                    </button>
                </div>

                {(isLoading || listingsLoading) && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading listings...</p>
                        </div>
                    </div>
                )}

                {!isLoading &&
                    !listingsLoading &&
                    filteredListings.length === 0 && (
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="text-center">
                                <p className="text-xl text-gray-600 mb-2">
                                    {filter === "pending"
                                        ? "No listings with pending bookings"
                                        : "No verified listings yet"}
                                </p>
                                <p className="text-gray-500">
                                    {filter === "pending"
                                        ? "All caught up! No action needed."
                                        : "Create a listing to get started."}
                                </p>
                            </div>
                        </div>
                    )}

                {!isLoading &&
                    !listingsLoading &&
                    filteredListings.length > 0 && (
                        <div className="space-y-6">
                            {filteredListings.map((listing) => (
                                <div
                                    key={listing.id}
                                    className="bg-white border rounded-lg shadow-sm"
                                >
                                    <div className="p-6 border-b border-gray-200">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <p className="font-semibold text-xl">
                                                        {listing.make &&
                                                        listing.model
                                                            ? `${
                                                                  listing.make
                                                              } ${
                                                                  listing.model
                                                              }${
                                                                  listing.year
                                                                      ? ` (${listing.year})`
                                                                      : ""
                                                              }`
                                                            : `Listing #${listing.id}`}
                                                    </p>
                                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-200 text-green-800">
                                                        Verified & Active
                                                    </span>
                                                    {listing.bookingCount >
                                                        0 && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                            {
                                                                listing.bookingCount
                                                            }{" "}
                                                            {listing.bookingCount ===
                                                            1
                                                                ? "Booking"
                                                                : "Bookings"}
                                                        </span>
                                                    )}
                                                </div>
                                                {listing.location && (
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        {listing.location}
                                                    </p>
                                                )}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-sm text-gray-600">
                                                            Daily Price
                                                        </p>
                                                        <p className="font-semibold">
                                                            {listing.dailyPrice}{" "}
                                                            ETH
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">
                                                            Security Deposit
                                                        </p>
                                                        <p className="font-semibold">
                                                            {listing.deposit}{" "}
                                                            ETH
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {listing.bookings.length > 0 ? (
                                        <div className="p-6 space-y-4">
                                            <h3 className="text-lg font-semibold text-gray-700 mb-4">
                                                Bookings (
                                                {listing.bookings.length})
                                            </h3>
                                            {listing.bookings.map((booking) => (
                                                <div
                                                    key={booking.id}
                                                    className="bg-gray-50 border rounded-lg p-4"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <p className="font-semibold">
                                                                    Booking #
                                                                    {booking.id}
                                                                </p>
                                                                <span
                                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                                        booking.status
                                                                    )}`}
                                                                >
                                                                    {getStatusName(
                                                                        booking.status
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 mb-3">
                                                                <div>
                                                                    <p className="text-sm text-gray-600">
                                                                        Booking
                                                                        Dates
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
                                                                        Renter
                                                                    </p>
                                                                    <p className="font-mono text-sm">
                                                                        {
                                                                            booking.renter
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                                                <div>
                                                                    <p className="text-sm text-gray-600">
                                                                        Rental
                                                                        Cost
                                                                    </p>
                                                                    <p className="font-semibold">
                                                                        {
                                                                            booking.rentalCost
                                                                        }{" "}
                                                                        ETH
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm text-gray-600">
                                                                        Deposit
                                                                    </p>
                                                                    <p className="font-semibold">
                                                                        {
                                                                            booking.deposit
                                                                        }{" "}
                                                                        ETH
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
                                                                            if (
                                                                                result.success
                                                                            ) {
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
                                                                            if (
                                                                                result.success
                                                                            ) {
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
                                                                BookingStatus.Active && (
                                                                <div className="space-y-2">
                                                                    <label className="block text-xs text-gray-600 mb-1">
                                                        Upload Return Proof:
                                                                    </label>
                                                                    <input
                                                                        type="file"
                                                                        id={`return-${booking.id}`}
                                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                                        onChange={(e) => handleReturnFileChange(booking.id, e)}
                                                                        disabled={uploadingReturn[booking.id]}
                                                                        className="block w-full text-xs text-gray-500
                                                                            file:mr-2 file:py-1 file:px-2
                                                                            file:rounded file:border-0
                                                                            file:text-xs file:font-semibold
                                                                            file:bg-blue-50 file:text-blue-700
                                                                            hover:file:bg-blue-100
                                                                            disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    />
                                                                    {uploadingReturn[booking.id] && (
                                                                        <div className="flex items-center gap-1 text-xs text-gray-600">
                                                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                                                            Uploading...
                                                                        </div>
                                                                    )}
                                                                    {returnFiles[booking.id] && !uploadingReturn[booking.id] && (
                                                                        <p className="text-xs text-green-600">
                                                                            ✓ {returnFiles[booking.id].name}
                                                                        </p>
                                                                    )}
                                                                    {booking.returnProofURI_owner && (
                                                                        <IPFSViewer 
                                                                            ipfsURI={booking.returnProofURI_owner}
                                                                            title="View return proof"
                                                                            className="text-xs"
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}
                                                            {canOpenDispute(
                                                                booking.status
                                                            ) &&
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
                                                                            if (
                                                                                result.success
                                                                            ) {
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
                                                                        Open
                                                                        Dispute
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-gray-500">
                                            <p>
                                                No bookings yet for this listing
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
            </div>
        </div>
    );
};
