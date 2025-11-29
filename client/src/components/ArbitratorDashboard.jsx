import React, { useState, useEffect, useCallback } from "react";
import { contractService } from "../services/contractService";
import { useUser } from "../hooks/useUser";
import { web3Service } from "../services/web3Service";

export const ArbitratorDashboard = ({ contract, log }) => {
    const { balance, walletBalance } = useUser(contract);
    const [disputedBookings, setDisputedBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [resolveForm, setResolveForm] = useState({
        bookingId: "",
        ownerPayout: "",
        renterPayout: "",
    });

    const loadDisputedBookings = useCallback(async () => {
        if (!contract) return;
        setIsLoading(true);
        try {
            const disputes = await contractService.getDisputedBookings();
            setDisputedBookings(disputes);
        } catch (error) {
            log(`Error loading disputes: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [contract, log]);

    useEffect(() => {
        if (contract) {
            loadDisputedBookings();
        }
    }, [contract, loadDisputedBookings]);

    // Listen for account changes and reload disputes
    useEffect(() => {
        if (!web3Service.isInitialized()) return;

        const unsubscribe = web3Service.onAccountChange((newAccount) => {
            if (contract && newAccount) {
                loadDisputedBookings();
            }
        });

        return unsubscribe;
    }, [contract, loadDisputedBookings]);

    const handleResolveDispute = async (e) => {
        e.preventDefault();
        if (
            !resolveForm.bookingId ||
            !resolveForm.ownerPayout ||
            !resolveForm.renterPayout
        ) {
            log("Fill all fields");
            return;
        }

        const ownerPayout = parseFloat(resolveForm.ownerPayout);
        const renterPayout = parseFloat(resolveForm.renterPayout);

        if (ownerPayout < 0 || renterPayout < 0) {
            log("Payouts can't be negative");
            return;
        }

        log(`Resolving booking ${resolveForm.bookingId}...`);
        try {
            await contractService.resolveDispute(
                Number(resolveForm.bookingId),
                ownerPayout,
                renterPayout
            );
            log(
                `Resolved: Owner ${ownerPayout} ETH, Renter ${renterPayout} ETH`
            );
            setResolveForm({
                bookingId: "",
                ownerPayout: "",
                renterPayout: "",
            });
            await loadDisputedBookings();
        } catch (error) {
            log(`Error: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">
                    Arbitrator Dashboard
                </h3>
                <p>Wallet Balance: {walletBalance} ETH</p>
                <p>Contract Balance (Available to Withdraw): {balance} ETH</p>
                <p className="text-sm text-gray-600 mt-2">
                    Your role: Resolve disputes between owners and renters
                </p>
            </div>

            <div>
                <h3 className="text-xl font-semibold mb-4">Resolve Dispute</h3>
                <form onSubmit={handleResolveDispute} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <input
                                type="number"
                                placeholder="Booking/Dispute ID"
                                value={resolveForm.bookingId}
                                onChange={(e) =>
                                    setResolveForm({
                                        ...resolveForm,
                                        bookingId: e.target.value,
                                    })
                                }
                                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Note: Booking ID = Dispute ID (same number)
                            </p>
                        </div>
                        <input
                            type="number"
                            step="0.001"
                            placeholder="Owner Payout (ETH)"
                            value={resolveForm.ownerPayout}
                            onChange={(e) =>
                                setResolveForm({
                                    ...resolveForm,
                                    ownerPayout: e.target.value,
                                })
                            }
                            className="border border-gray-300 rounded-lg px-4 py-2"
                            required
                        />
                        <input
                            type="number"
                            step="0.001"
                            placeholder="Renter Payout (ETH)"
                            value={resolveForm.renterPayout}
                            onChange={(e) =>
                                setResolveForm({
                                    ...resolveForm,
                                    renterPayout: e.target.value,
                                })
                            }
                            className="border border-gray-300 rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg"
                    >
                        Resolve Dispute
                    </button>
                </form>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">
                        Pending Disputes ({disputedBookings.length})
                    </h3>
                    <button
                        onClick={loadDisputedBookings}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Refresh
                    </button>
                </div>
                {isLoading ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        Loading disputes...
                    </div>
                ) : disputedBookings.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                        No pending disputes
                    </div>
                ) : (
                    <div className="space-y-4">
                        {disputedBookings.map((booking) => (
                            <div
                                key={booking.id}
                                className="border rounded-lg p-4 bg-red-50 hover:bg-red-100 transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="font-semibold text-lg">
                                            Dispute (Booking ID: {booking.id})
                                        </p>
                                        {booking.listing && (
                                            <p className="text-sm text-gray-700 mt-1">
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
                                        )}
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p>
                                                <strong>Owner:</strong>{" "}
                                                {booking.owner.slice(0, 10)}...
                                            </p>
                                            <p>
                                                <strong>Renter:</strong>{" "}
                                                {booking.renter.slice(0, 10)}...
                                            </p>
                                            <p>
                                                <strong>Escrow:</strong>{" "}
                                                {booking.escrow} ETH
                                            </p>
                                            <p>
                                                <strong>Rental Cost:</strong>{" "}
                                                {booking.rentalCost} ETH
                                            </p>
                                            <p>
                                                <strong>Deposit:</strong>{" "}
                                                {booking.deposit} ETH
                                            </p>
                                            <p>
                                                <strong>Dates:</strong>{" "}
                                                {booking.startDate.toLocaleDateString()}{" "}
                                                -{" "}
                                                {booking.endDate.toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setResolveForm({
                                                bookingId:
                                                    booking.id.toString(),
                                                ownerPayout: "",
                                                renterPayout: "",
                                            });
                                        }}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium ml-4"
                                    >
                                        Resolve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
