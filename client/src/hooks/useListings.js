import { useState, useCallback } from "react";
import { contractService } from "../services/contractService";

/**
 * Hook for managing listings
 */
export const useListings = (contract) => {
    const [listings, setListings] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadListings = useCallback(async () => {
        if (!contract) return;

        setIsLoading(true);
        setError(null);
        try {
            const allListings = await contractService.getAllListings();
            setListings(allListings);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [contract]);

    const createListing = useCallback(
        async (
            dailyPrice,
            deposit,
            insuranceDocURI,
            make,
            model,
            year,
            location
        ) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                const result = await contractService.createListing(
                    dailyPrice,
                    deposit,
                    insuranceDocURI,
                    make,
                    model,
                    year,
                    location
                );
                if (result.success) {
                    await loadListings();
                    return result;
                }
                return result;
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadListings]
    );

    const verifyInsurance = useCallback(
        async (listingId, isValid) => {
            if (!contract)
                return { success: false, error: "Contract not loaded" };

            setIsLoading(true);
            setError(null);
            try {
                await contractService.verifyInsurance(listingId, isValid);
                await loadListings();
                return { success: true };
            } catch (err) {
                setError(err.message);
                return { success: false, error: err.message };
            } finally {
                setIsLoading(false);
            }
        },
        [contract, loadListings]
    );

    return {
        listings,
        isLoading,
        error,
        loadListings,
        createListing,
        verifyInsurance,
    };
};
