import { useState, useEffect, useCallback } from "react";
import { contractService } from "../services/contractService";
import { web3Service } from "../services/web3Service";

/**
 * Hook for managing contract state and operations
 */
export const useContract = () => {
    // Initialize with contract from contractService if already loaded
    const [contract, setContract] = useState(() => {
        return contractService.isLoaded()
            ? contractService.getContract()
            : null;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadContract = useCallback(async (contractAddress) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await contractService.loadContract(contractAddress);
            if (result.success) {
                setContract(result.contract);
                return { success: true };
            } else {
                setError(result.error);
                return { success: false, error: result.error };
            }
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        contract,
        isLoading,
        error,
        loadContract,
        isLoaded: contractService.isLoaded(),
    };
};
