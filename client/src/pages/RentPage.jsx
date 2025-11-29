import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { useContract } from "../hooks/useContract";
import { useListings } from "../hooks/useListings";
import { useUser } from "../hooks/useUser";
import { useBookings } from "../hooks/useBookings";
import { contractService } from "../services/contractService";
import { web3Service } from "../services/web3Service";
import { CONTRACT_ADDRESS } from "../constants/config";
import { InsuranceStatus } from "../constants/insuranceStatus";

export const RentPage = () => {
    const { contract, loadContract, isLoaded } = useContract();
    const { listings, isLoading, loadListings, error } = useListings(contract);
    const { isRegistered, isInsuranceVerifier, isArbitrator } =
        useUser(contract);
    const { requestBooking, isLoading: isBookingLoading } =
        useBookings(contract);
    const [isInitializing, setIsInitializing] = useState(true);
    const [selectedListing, setSelectedListing] = useState(null);
    const [bookingForm, setBookingForm] = useState({
        startDate: "",
        endDate: "",
    });
    const [escrowAmount, setEscrowAmount] = useState(null);
    const [bookingError, setBookingError] = useState("");
    const [bookingSuccess, setBookingSuccess] = useState(false);

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

    useEffect(() => {
        if (contract && !isInitializing) {
            loadListings();
        }
    }, [contract, loadListings, isInitializing]);

    useEffect(() => {
        const calculateEscrow = async () => {
            if (
                !selectedListing ||
                !bookingForm.startDate ||
                !bookingForm.endDate
            ) {
                setEscrowAmount(null);
                return;
            }

            try {
                const escrow = contractService.calculateEscrow(
                    selectedListing,
                    bookingForm.startDate,
                    bookingForm.endDate
                );
                setEscrowAmount(escrow);
                setBookingError("");
            } catch (error) {
                setEscrowAmount(null);
                setBookingError(error.message);
            }
        };

        calculateEscrow();
    }, [selectedListing, bookingForm.startDate, bookingForm.endDate]);

    const availableListings = listings.filter(
        (listing) =>
            listing.active &&
            listing.insuranceStatus === InsuranceStatus.Approved
    );

    const getCarImageUrl = (make, model) => {
        const searchTerm = `${make} ${model}`.replace(/\s+/g, "+");
        return `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop&q=80`;
    };

    const handleOpenBookingModal = (listing) => {
        if (!isRegistered) {
            alert("Please register your account first to rent a car.");
            return;
        }
        setSelectedListing(listing);
        setBookingForm({ startDate: "", endDate: "" });
        setEscrowAmount(null);
        setBookingError("");
        setBookingSuccess(false);
    };

    const handleCloseBookingModal = () => {
        setSelectedListing(null);
        setBookingForm({ startDate: "", endDate: "" });
        setEscrowAmount(null);
        setBookingError("");
        setBookingSuccess(false);
    };

    const handleBookingFormChange = (e) => {
        const { name, value } = e.target;
        setBookingForm((prev) => ({
            ...prev,
            [name]: value,
        }));
        setBookingError("");
    };

    const handleRequestBooking = async (e) => {
        e.preventDefault();
        setBookingError("");
        setBookingSuccess(false);

        if (!bookingForm.startDate || !bookingForm.endDate) {
            setBookingError("Please select both start and end dates");
            return;
        }

        if (!selectedListing) {
            setBookingError("No listing selected");
            return;
        }

        try {
            const result = await requestBooking(
                selectedListing.id,
                bookingForm.startDate,
                bookingForm.endDate
            );

            if (result.success) {
                setBookingSuccess(true);
                setTimeout(() => {
                    handleCloseBookingModal();
                    loadListings(); // Refresh listings
                }, 2000);
            } else {
                setBookingError(result.error || "Failed to request booking");
            }
        } catch (error) {
            setBookingError(error.message || "An error occurred");
        }
    };

    // Get minimum date (tomorrow)
    const getMinDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.toISOString().split("T")[0];
    };

    // Get minimum end date (start date + 1 day)
    const getMinEndDate = () => {
        if (!bookingForm.startDate) return getMinDate();
        const startDate = new Date(bookingForm.startDate);
        startDate.setDate(startDate.getDate() + 1);
        return startDate.toISOString().split("T")[0];
    };

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

    if (isRegistered && (isInsuranceVerifier || isArbitrator)) {
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
                        Available Cars for Rent
                    </h1>
                    <p className="text-gray-600">
                        {availableListings.length} car
                        {availableListings.length !== 1 ? "s" : ""} available
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading cars...</p>
                        </div>
                    </div>
                )}

                {!isLoading && availableListings.length === 0 && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <p className="text-xl text-gray-600 mb-2">
                                No cars available at the moment
                            </p>
                            <p className="text-gray-500">
                                Check back later for new listings
                            </p>
                        </div>
                    </div>
                )}

                {!isLoading && availableListings.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {availableListings.map((listing) => (
                            <div
                                key={listing.id}
                                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden group"
                            >
                                <div className="relative h-48 bg-gray-200 overflow-hidden">
                                    <img
                                        src={getCarImageUrl(
                                            listing.make,
                                            listing.model
                                        )}
                                        alt={`${listing.make} ${listing.model}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                        onError={(e) => {
                                            e.target.src =
                                                "https://via.placeholder.com/400x300?text=Car+Image";
                                        }}
                                    />
                                </div>

                                <div className="p-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
                                        {listing.make} {listing.model}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-2">
                                        {listing.year} • {listing.location}
                                    </p>

                                    <div className="flex items-baseline mt-3 pt-3 border-t border-gray-100 mb-3">
                                        <span className="text-2xl font-bold text-gray-900">
                                            {parseFloat(
                                                listing.dailyPrice
                                            ).toFixed(3)}
                                        </span>
                                        <span className="text-sm text-gray-600 ml-1">
                                            ETH/day
                                        </span>
                                    </div>

                                    <button
                                        onClick={() =>
                                            handleOpenBookingModal(listing)
                                        }
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Rent Now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {selectedListing && (
                    <>
                        <div
                            className="fixed inset-0 bg-black bg-opacity-50 z-40"
                            onClick={handleCloseBookingModal}
                        ></div>
                        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                            <div
                                className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900">
                                                Rent {selectedListing.make}{" "}
                                                {selectedListing.model}
                                            </h2>
                                            <p className="text-gray-600 mt-1">
                                                {selectedListing.year} •{" "}
                                                {selectedListing.location}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleCloseBookingModal}
                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            <svg
                                                className="w-6 h-6"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    </div>

                                    {bookingSuccess && (
                                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <p className="text-green-800 font-medium">
                                                Booking requested successfully!
                                                Redirecting...
                                            </p>
                                        </div>
                                    )}

                                    {bookingError && (
                                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <p className="text-red-800">
                                                {bookingError}
                                            </p>
                                        </div>
                                    )}

                                    <form onSubmit={handleRequestBooking}>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label
                                                        htmlFor="startDate"
                                                        className="block text-sm font-medium text-gray-700 mb-2"
                                                    >
                                                        Start Date{" "}
                                                        <span className="text-red-500">
                                                            *
                                                        </span>
                                                    </label>
                                                    <input
                                                        type="date"
                                                        id="startDate"
                                                        name="startDate"
                                                        value={
                                                            bookingForm.startDate
                                                        }
                                                        onChange={
                                                            handleBookingFormChange
                                                        }
                                                        min={getMinDate()}
                                                        required
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label
                                                        htmlFor="endDate"
                                                        className="block text-sm font-medium text-gray-700 mb-2"
                                                    >
                                                        End Date{" "}
                                                        <span className="text-red-500">
                                                            *
                                                        </span>
                                                    </label>
                                                    <input
                                                        type="date"
                                                        id="endDate"
                                                        name="endDate"
                                                        value={
                                                            bookingForm.endDate
                                                        }
                                                        onChange={
                                                            handleBookingFormChange
                                                        }
                                                        min={getMinEndDate()}
                                                        required
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>

                                            {escrowAmount && (
                                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                    <h3 className="font-semibold text-gray-900 mb-3">
                                                        Price Breakdown
                                                    </h3>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-600">
                                                                Daily Price
                                                            </span>
                                                            <span className="font-medium">
                                                                {parseFloat(
                                                                    selectedListing.dailyPrice
                                                                ).toFixed(
                                                                    3
                                                                )}{" "}
                                                                ETH/day
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-600">
                                                                Rental Period
                                                            </span>
                                                            <span className="font-medium">
                                                                {
                                                                    escrowAmount.days
                                                                }{" "}
                                                                day
                                                                {escrowAmount.days !==
                                                                1
                                                                    ? "s"
                                                                    : ""}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-600">
                                                                Rental Cost
                                                            </span>
                                                            <span className="font-medium">
                                                                {parseFloat(
                                                                    web3Service.fromWei(
                                                                        escrowAmount.rentalCost,
                                                                        "ether"
                                                                    )
                                                                ).toFixed(
                                                                    3
                                                                )}{" "}
                                                                ETH
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-600">
                                                                Security Deposit
                                                            </span>
                                                            <span className="font-medium">
                                                                {parseFloat(
                                                                    selectedListing.deposit
                                                                ).toFixed(
                                                                    3
                                                                )}{" "}
                                                                ETH
                                                            </span>
                                                        </div>
                                                        <div className="border-t border-gray-300 pt-2 mt-2">
                                                            <div className="flex justify-between">
                                                                <span className="font-semibold text-gray-900">
                                                                    Total Amount
                                                                </span>
                                                                <span className="font-bold text-indigo-600 text-lg">
                                                                    {
                                                                        escrowAmount.escrowEth
                                                                    }{" "}
                                                                    ETH
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-3 pt-4">
                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleCloseBookingModal
                                                    }
                                                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={
                                                        isBookingLoading ||
                                                        !escrowAmount ||
                                                        bookingSuccess
                                                    }
                                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                                                >
                                                    {isBookingLoading
                                                        ? "Processing..."
                                                        : "Request Booking"}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
