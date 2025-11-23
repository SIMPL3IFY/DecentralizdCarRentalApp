import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { useContract } from "../hooks/useContract";
import { useListings } from "../hooks/useListings";
import { CONTRACT_ADDRESS } from "../constants/config";

export const RentPage = () => {
    const { contract, loadContract, isLoaded } = useContract();
    const { listings, isLoading, loadListings, error } = useListings(contract);
    const [isInitializing, setIsInitializing] = useState(true);

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

    // Load listings when contract is available
    useEffect(() => {
        if (contract && !isInitializing) {
            loadListings();
        }
    }, [contract, loadListings, isInitializing]);

    // Filter only active and insurance-valid listings
    const availableListings = listings.filter(
        (listing) => listing.active && listing.insuranceValid
    );

    // Generate placeholder image URL based on car make/model
    const getCarImageUrl = (make, model) => {
        // Using a placeholder service - can be replaced with actual images later
        const searchTerm = `${make} ${model}`.replace(/\s+/g, "+");
        return `https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop&q=80`;
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

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Available Cars for Rent
                    </h1>
                    <p className="text-gray-600">
                        {availableListings.length} car
                        {availableListings.length !== 1 ? "s" : ""} available
                    </p>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading cars...</p>
                        </div>
                    </div>
                )}

                {/* Empty State */}
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

                {/* Car Cards Grid */}
                {!isLoading && availableListings.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {availableListings.map((listing) => (
                            <div
                                key={listing.id}
                                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer group"
                            >
                                {/* Car Image */}
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

                                {/* Car Info */}
                                <div className="p-4">
                                    {/* Car Name */}
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
                                        {listing.make} {listing.model}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-2">
                                        {listing.year} • {listing.location}
                                    </p>

                                    {/* Price */}
                                    <div className="flex items-baseline mt-3 pt-3 border-t border-gray-100">
                                        <span className="text-2xl font-bold text-gray-900">
                                            {parseFloat(
                                                listing.dailyPrice
                                            ).toFixed(3)}
                                        </span>
                                        <span className="text-sm text-gray-600 ml-1">
                                            ETH/day
                                        </span>
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
