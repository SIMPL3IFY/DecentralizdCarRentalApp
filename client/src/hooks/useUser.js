import { useState, useEffect, useCallback, useRef } from "react";
import { contractService } from "../services/contractService";
import { web3Service } from "../services/web3Service";

export const useUser = (contract) => {
    const [isRegistered, setIsRegistered] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isInsuranceVerifier, setIsInsuranceVerifier] = useState(false);
    const [isArbitrator, setIsArbitrator] = useState(false);
    const [balance, setBalance] = useState("0");
    const [walletBalance, setWalletBalance] = useState("0");
    const currentAccountRef = useRef(null);

    const fetchWalletBalance = useCallback(async () => {
        try {
            const walletBal = await contractService
                .getWalletBalance()
                .catch(() => "0");
            setWalletBalance(walletBal);
        } catch (error) {
            setWalletBalance("0");
        }
    }, []);

    const fetchUserData = useCallback(async () => {
        try {
            const [verifier, arbitrator, userBalance, walletBal] =
                await Promise.all([
                    contractService.isInsuranceVerifier(),
                    contractService.isArbitrator(),
                    contractService.getBalance().catch(() => "0"),
                    contractService.getWalletBalance().catch(() => "0"),
                ]);

            setIsInsuranceVerifier(verifier);
            setIsArbitrator(arbitrator);
            setBalance(userBalance);
            setWalletBalance(walletBal);
        } catch (error) {
            console.error("Error fetching user data:", error);
            setBalance("0");
            setWalletBalance("0");
        }
    }, []);

    const checkRegistration = useCallback(async () => {
        if (!contract || !web3Service.isInitialized()) {
            console.log(
                "Cannot check registration: contract or web3 not initialized"
            );
            return;
        }

        setIsLoading(true);
        try {
            const registered = await contractService.isRegistered();
            setIsRegistered(registered);

            if (registered) {
                await fetchUserData();
            } else {
                await fetchWalletBalance();
            }
        } catch (error) {
            console.error("Error checking registration:", error);
        } finally {
            setIsLoading(false);
        }
    }, [contract, fetchUserData, fetchWalletBalance]);

    const register = useCallback(async () => {
        if (!contract) return { success: false, error: "Contract not loaded" };

        setIsLoading(true);
        try {
            await contractService.register();
            await checkRegistration();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            setIsLoading(false);
        }
    }, [contract, checkRegistration]);

    // Check registration when contract changes
    useEffect(() => {
        checkRegistration();
    }, [checkRegistration]);

    // Listen for account changes and refresh when account switches
    useEffect(() => {
        const currentAccount = web3Service.getAccount();
        if (currentAccount) {
            currentAccountRef.current = currentAccount;
        }

        const unsubscribe = web3Service.onAccountChange((newAccount) => {
            if (newAccount && newAccount !== currentAccountRef.current) {
                currentAccountRef.current = newAccount;
                checkRegistration();
            }
        });

        return unsubscribe;
    }, [checkRegistration]);

    useEffect(() => {
        if (contract && isRegistered) {
            fetchUserData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRegistered, contract]);

    return {
        isRegistered,
        isLoading,
        register,
        checkRegistration,
        isInsuranceVerifier,
        isArbitrator,
        balance,
        walletBalance,
    };
};
