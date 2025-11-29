import { useState, useCallback } from "react";
import { contractService } from "../services/contractService";

export const useBookings = (contract) => {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadBookings = useCallback(async () => {
        if (!contract) return;

        setIsLoading(true);
        setError(null);
        try {
            const myBookings = await contractService.getMyBookings();
            setBookings(myBookings);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [contract]);

    const requestBooking = useCallback(
        async (listingId, startDate, endDate, renterInsuranceDocURI) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                const result = await contractService.requestBooking(
                    listingId,
                    startDate,
                    endDate,
                    renterInsuranceDocURI
                );
                if (result.success) {
                    await loadBookings();
                }
                return result;
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadBookings]
    );

    const approveBooking = useCallback(
        async (bookingId) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                await contractService.approveBooking(bookingId);
                await loadBookings();
                return { success: true };
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadBookings]
    );

    const rejectBooking = useCallback(
        async (bookingId) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                await contractService.rejectBooking(bookingId);
                await loadBookings();
                return { success: true };
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadBookings]
    );

    const cancelBooking = useCallback(
        async (bookingId) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                await contractService.cancelBooking(bookingId);
                await loadBookings();
                return { success: true };
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadBookings]
    );

    const confirmPickup = useCallback(
        async (bookingId, proofURI) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                await contractService.confirmPickup(bookingId, proofURI);
                await loadBookings();
                return { success: true };
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadBookings]
    );

    const confirmReturn = useCallback(
        async (bookingId, proofURI) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                await contractService.confirmReturn(bookingId, proofURI);
                await loadBookings();
                return { success: true };
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadBookings]
    );

    const openDispute = useCallback(
        async (bookingId) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                await contractService.openDispute(bookingId);
                await loadBookings();
                return { success: true };
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadBookings]
    );

    return {
        bookings,
        isLoading,
        error,
        loadBookings,
        requestBooking,
        approveBooking,
        rejectBooking,
        cancelBooking,
        confirmPickup,
        confirmReturn,
        openDispute,
    };
};
