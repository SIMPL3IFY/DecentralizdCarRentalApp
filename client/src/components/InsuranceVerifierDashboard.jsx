import React, { useState, useEffect } from "react";
import { useListings } from "../hooks/useListings";
import { useUser } from "../hooks/useUser";

export const InsuranceVerifierDashboard = ({ contract, log }) => {
    const { listings, isLoading, loadListings, verifyInsurance } =
        useListings(contract);
    const { balance, walletBalance } = useUser(contract);

    useEffect(() => {
        if (contract) {
            loadListings();
        }
    }, [contract, loadListings]);

    const handleVerifyInsurance = async (listingId, isValid) => {
        log(`Verifying listing ${listingId}...`);
        const result = await verifyInsurance(listingId, isValid);
        if (result.success) {
            log(`Insurance ${isValid ? "verified" : "rejected"}`);
        } else {
            log(`Error: ${result.error}`);
        }
    };

    const unverifiedListings = listings.filter((l) => !l.insuranceValid);
    const verifiedListings = listings.filter((l) => l.insuranceValid);

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">
                    Insurance Verifier Dashboard
                </h3>
                <p>Wallet Balance: {walletBalance} ETH</p>
                <p>Contract Balance (Available to Withdraw): {balance} ETH</p>
                <p className="text-sm text-gray-600 mt-2">
                    Your role: Verify insurance documents for car listings
                </p>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">
                        Listings Pending Verification (
                        {unverifiedListings.length})
                    </h3>
                    <button
                        onClick={loadListings}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Refresh
                    </button>
                </div>
                {isLoading ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        Loading listings...
                    </div>
                ) : unverifiedListings.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        No listings pending verification
                    </div>
                ) : (
                    <div className="space-y-4">
                        {unverifiedListings.map((listing) => (
                            <div
                                key={listing.id}
                                className="border rounded-lg p-4 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
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
                                            <p className="text-sm text-gray-600 mb-2">
                                                {listing.location}
                                            </p>
                                        )}
                                        <p className="text-sm">
                                            Daily Price: {listing.dailyPrice}{" "}
                                            ETH
                                        </p>
                                        <p className="text-sm">
                                            Security Deposit: {listing.deposit}{" "}
                                            ETH
                                        </p>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Listing ID: {listing.id} | Owner:{" "}
                                            {listing.owner.slice(0, 10)}...
                                        </p>
                                        {listing.insuranceDocURI && (
                                            <p className="text-xs text-blue-600 mt-1">
                                                Insurance Doc:{" "}
                                                {listing.insuranceDocURI}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() =>
                                                handleVerifyInsurance(
                                                    listing.id,
                                                    true
                                                )
                                            }
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleVerifyInsurance(
                                                    listing.id,
                                                    false
                                                )
                                            }
                                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">
                        Verified Listings ({verifiedListings.length})
                    </h3>
                </div>
                {verifiedListings.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        No verified listings yet
                    </div>
                ) : (
                    <div className="space-y-4">
                        {verifiedListings.map((listing) => (
                            <div
                                key={listing.id}
                                className="border rounded-lg p-4 bg-green-50"
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
                                <p className="text-sm">
                                    Daily Price: {listing.dailyPrice} ETH
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                    Listing ID: {listing.id} | Status:{" "}
                                    <span className="text-green-600 font-semibold">
                                        Verified
                                    </span>
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
