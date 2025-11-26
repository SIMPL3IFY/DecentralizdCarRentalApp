import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { useContract } from "../hooks/useContract";
import { useUser } from "../hooks/useUser";
import { useListings } from "../hooks/useListings";
import { CONTRACT_ADDRESS } from "../constants/config";
import { contractService } from "../services/contractService";

export const ListPage = () => {
    const { contract, loadContract, isLoaded } = useContract();
    const {
        isRegistered,
        isInsuranceVerifier,
        isArbitrator,
        checkRegistration,
    } = useUser(contract);
    const { createListing, isLoading: isCreatingListing } =
        useListings(contract);

    const [formData, setFormData] = useState({
        make: "",
        model: "",
        year: "",
        location: "",
        dailyPrice: "",
        deposit: "",
        insuranceDocURI: "",
    });

    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);
    const [listingId, setListingId] = useState(null);
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.make.trim()) {
            newErrors.make = "Make is required";
        }
        if (!formData.model.trim()) {
            newErrors.model = "Model is required";
        }
        if (
            !formData.year ||
            formData.year < 1900 ||
            formData.year > new Date().getFullYear() + 1
        ) {
            newErrors.year = "Please enter a valid year";
        }
        if (!formData.location.trim()) {
            newErrors.location = "Location is required";
        }
        if (!formData.dailyPrice || parseFloat(formData.dailyPrice) <= 0) {
            newErrors.dailyPrice = "Please enter a valid daily price";
        }
        if (!formData.deposit || parseFloat(formData.deposit) < 0) {
            newErrors.deposit = "Please enter a valid deposit amount";
        }
        if (!formData.insuranceDocURI.trim()) {
            newErrors.insuranceDocURI = "Insurance document URI is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccess(false);
        setListingId(null);

        if (!validateForm()) {
            return;
        }

        if (!contract) {
            alert("Contract not loaded. Please wait a moment and try again.");
            return;
        }

        if (!isRegistered) {
            alert("Please register your account first using the profile menu.");
            return;
        }

        try {
            const result = await createListing(
                formData.dailyPrice,
                formData.deposit,
                formData.insuranceDocURI,
                formData.make,
                formData.model,
                Number(formData.year),
                formData.location
            );

            if (result.success) {
                setSuccess(true);
                setListingId(result.listingId);
                // Reset form
                setFormData({
                    make: "",
                    model: "",
                    year: "",
                    location: "",
                    dailyPrice: "",
                    deposit: "",
                    insuranceDocURI: "",
                });
                // Scroll to success message
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                alert(`Failed to create listing: ${result.error}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
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
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
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
        <div className="bg-indigo-50">
            <Navbar />

            <div className="w-full px-18 py-12 ">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        List Your Car
                    </h1>
                    <p className="text-lg text-gray-600">
                        Share your car and start earning. Fill out the form
                        below to create your listing.
                    </p>
                </div>

                {/* Main Form Card */}
                <div className="w-full">
                    <form onSubmit={handleSubmit} className="p-8">
                        {/* Car Information Section */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                                Car Information
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Make */}
                                <div>
                                    <label
                                        htmlFor="make"
                                        className="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Make{" "}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="make"
                                        name="make"
                                        value={formData.make}
                                        onChange={handleChange}
                                        placeholder="e.g., Toyota, Honda, BMW"
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                                            errors.make
                                                ? "border-red-300"
                                                : "border-gray-300"
                                        }`}
                                    />
                                    {errors.make && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.make}
                                        </p>
                                    )}
                                </div>

                                {/* Model */}
                                <div>
                                    <label
                                        htmlFor="model"
                                        className="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Model{" "}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="model"
                                        name="model"
                                        value={formData.model}
                                        onChange={handleChange}
                                        placeholder="e.g., Camry, Civic, 3 Series"
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                                            errors.model
                                                ? "border-red-300"
                                                : "border-gray-300"
                                        }`}
                                    />
                                    {errors.model && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.model}
                                        </p>
                                    )}
                                </div>

                                {/* Year */}
                                <div>
                                    <label
                                        htmlFor="year"
                                        className="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Year{" "}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        id="year"
                                        name="year"
                                        value={formData.year}
                                        onChange={handleChange}
                                        placeholder="e.g., 2020"
                                        min="1900"
                                        max={new Date().getFullYear() + 1}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                                            errors.year
                                                ? "border-red-300"
                                                : "border-gray-300"
                                        }`}
                                    />
                                    {errors.year && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.year}
                                        </p>
                                    )}
                                </div>

                                {/* Location */}
                                <div>
                                    <label
                                        htmlFor="location"
                                        className="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Location{" "}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="location"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        placeholder="e.g., New York, NY"
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                                            errors.location
                                                ? "border-red-300"
                                                : "border-gray-300"
                                        }`}
                                    />
                                    {errors.location && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.location}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pricing Section */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                                Pricing & Security
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Daily Price */}
                                <div>
                                    <label
                                        htmlFor="dailyPrice"
                                        className="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Daily Price (ETH){" "}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            id="dailyPrice"
                                            name="dailyPrice"
                                            value={formData.dailyPrice}
                                            onChange={handleChange}
                                            placeholder="0.05"
                                            step="0.001"
                                            min="0"
                                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                                                errors.dailyPrice
                                                    ? "border-red-300"
                                                    : "border-gray-300"
                                            }`}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <span className="text-gray-500 text-sm">
                                                ETH
                                            </span>
                                        </div>
                                    </div>
                                    {errors.dailyPrice && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.dailyPrice}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-gray-500">
                                        The amount you'll charge per day
                                    </p>
                                </div>

                                {/* Security Deposit */}
                                <div>
                                    <label
                                        htmlFor="deposit"
                                        className="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Security Deposit (ETH){" "}
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            id="deposit"
                                            name="deposit"
                                            value={formData.deposit}
                                            onChange={handleChange}
                                            placeholder="0.1"
                                            step="0.001"
                                            min="0"
                                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                                                errors.deposit
                                                    ? "border-red-300"
                                                    : "border-gray-300"
                                            }`}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <span className="text-gray-500 text-sm">
                                                ETH
                                            </span>
                                        </div>
                                    </div>
                                    {errors.deposit && (
                                        <p className="mt-1 text-sm text-red-600">
                                            {errors.deposit}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-gray-500">
                                        Refundable deposit held during rental
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Insurance Section */}
                        <div className="mb-10">
                            <h2 className="text-2xl font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                                Insurance Documentation
                            </h2>

                            <div>
                                <label
                                    htmlFor="insuranceDocURI"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Insurance Document URI{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="insuranceDocURI"
                                    name="insuranceDocURI"
                                    value={formData.insuranceDocURI}
                                    onChange={handleChange}
                                    placeholder="ipfs://insurance.pdf or https://..."
                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                                        errors.insuranceDocURI
                                            ? "border-red-300"
                                            : "border-gray-300"
                                    }`}
                                />
                                {errors.insuranceDocURI && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.insuranceDocURI}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                <span className="text-red-500">*</span> Required
                                fields
                            </div>
                            <button
                                type="submit"
                                disabled={
                                    isCreatingListing ||
                                    !contract ||
                                    !isRegistered
                                }
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
                            >
                                {isCreatingListing
                                    ? "Creating Listing..."
                                    : "Create Listing"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
