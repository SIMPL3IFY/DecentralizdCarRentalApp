import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useContract } from "../hooks/useContract";
import { useUser } from "../hooks/useUser";
import { web3Service } from "../services/web3Service";
import { contractService } from "../services/contractService";
import { CONTRACT_ADDRESS } from "../constants/config";

export const Navbar = () => {
    const location = useLocation();
    const currentPath = location.pathname;
    const { contract, loadContract, isLoaded } = useContract();
    const {
        isRegistered,
        isInsuranceVerifier,
        isArbitrator,
        checkRegistration,
        register,
        isLoading: isUserLoading,
    } = useUser(contract);
    const [showProfile, setShowProfile] = useState(false);
    const [availableAccounts, setAvailableAccounts] = useState([]);
    const [isSwitching, setIsSwitching] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isWeb3Initialized, setIsWeb3Initialized] = useState(false);
    const [currentAccount, setCurrentAccount] = useState(null);

    // Initialize Web3 and load contract
    useEffect(() => {
        const initializeApp = async () => {
            // Initialize Web3 if not already initialized
            if (!web3Service.isInitialized()) {
                try {
                    await web3Service.init();
                } catch (error) {
                    console.error("Error initializing Web3:", error);
                    return;
                }
            }
            setIsWeb3Initialized(web3Service.isInitialized());
            setCurrentAccount(web3Service.getAccount());

            // Load contract if not already loaded
            if (!isLoaded) {
                const contractAddressToLoad =
                    CONTRACT_ADDRESS || localStorage.getItem("contractAddress");

                if (contractAddressToLoad) {
                    try {
                        const result = await loadContract(
                            contractAddressToLoad
                        );
                        if (result.success) {
                            localStorage.setItem(
                                "contractAddress",
                                contractAddressToLoad
                            );
                            console.log(
                                "Contract loaded in Navbar:",
                                contractAddressToLoad
                            );
                        } else {
                            console.error(
                                "Failed to load contract:",
                                result.error
                            );
                        }
                    } catch (error) {
                        console.error("Error loading contract:", error);
                    }
                }
            }
        };
        initializeApp();
    }, [loadContract, isLoaded]);

    // Listen for account changes
    useEffect(() => {
        if (!isWeb3Initialized) return;

        const unsubscribe = web3Service.onAccountChange((newAccount) => {
            setCurrentAccount(newAccount);
        });

        return unsubscribe;
    }, [isWeb3Initialized]);

    useEffect(() => {
        const loadAccounts = async () => {
            if (isWeb3Initialized) {
                const accounts = await web3Service.getAccounts();
                setAvailableAccounts(accounts);
                setCurrentAccount(web3Service.getAccount());
            }
        };
        loadAccounts();
    }, [isWeb3Initialized]);

    // Update current account periodically to catch changes
    useEffect(() => {
        if (!isWeb3Initialized) return;

        const interval = setInterval(() => {
            const account = web3Service.getAccount();
            if (account !== currentAccount) {
                setCurrentAccount(account);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isWeb3Initialized, currentAccount]);

    const handleSwitchAccount = async (newAccount) => {
        if (newAccount === currentAccount) {
            return;
        }
        setIsSwitching(true);
        try {
            await web3Service.switchAccount(newAccount);
            await checkRegistration();
        } catch (error) {
            console.error("Error switching account:", error);
        } finally {
            setIsSwitching(false);
            setShowProfile(false);
        }
    };

    const handleRegister = async () => {
        if (!contract) {
            alert("Contract not loaded. Please wait for the contract to load.");
            return;
        }
        setIsRegistering(true);
        try {
            const result = await register();
            if (result.success) {
                await checkRegistration();
            } else {
                alert(`Registration failed: ${result.error}`);
            }
        } catch (error) {
            console.error("Error registering:", error);
            alert(`Registration error: ${error.message}`);
        } finally {
            setIsRegistering(false);
        }
    };

    const getRoles = () => {
        const roles = [];
        if (isRegistered) {
            if (isInsuranceVerifier) roles.push("Insurance Verifier");
            if (isArbitrator) roles.push("Arbitrator");
            if (!isInsuranceVerifier && !isArbitrator) {
                roles.push("Owner/Renter");
            }
        }
        return roles;
    };

    const formatAddress = (address) => {
        if (!address) return "Not connected";
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <nav className="bg-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-8">
                        <Link
                            to="/"
                            className="text-2xl font-bold text-indigo-600"
                        >
                            CarRental
                        </Link>
                        <div className="flex space-x-4">
                            <Link
                                to="/rent"
                                className={`px-2 py-1 ${
                                    currentPath === "/rent"
                                        ? "text-purple-600 font-semibold border-b-2 border-purple-600"
                                        : "text-gray-600 hover:text-indigo-600"
                                }`}
                            >
                                Rent
                            </Link>
                            <Link
                                to="/list"
                                className={`px-2 py-1 ${
                                    currentPath === "/list"
                                        ? "text-indigo-600 font-semibold border-b-2 border-indigo-600"
                                        : "text-gray-600 hover:text-indigo-600"
                                }`}
                            >
                                List Your Car
                            </Link>
                        </div>
                    </div>

                    {isWeb3Initialized && (
                        <div className="relative">
                            <button
                                onClick={() => setShowProfile(!showProfile)}
                                className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                                    {currentAccount
                                        ? currentAccount
                                              .slice(2, 4)
                                              .toUpperCase()
                                        : "?"}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-gray-700">
                                        {formatAddress(currentAccount)}
                                    </div>
                                    {isRegistered && (
                                        <div className="text-xs text-gray-500">
                                            {getRoles().join(", ") ||
                                                "Not registered"}
                                        </div>
                                    )}
                                </div>
                                <svg
                                    className={`w-4 h-4 text-gray-500 transition-transform ${
                                        showProfile ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </button>

                            {showProfile && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowProfile(false)}
                                    ></div>
                                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                                        <div className="p-4 border-b border-gray-200">
                                            <div className="text-sm font-semibold text-gray-700 mb-1">
                                                Current Account
                                            </div>
                                            <div className="text-sm text-gray-600 font-mono break-all">
                                                {currentAccount ||
                                                    "Not connected"}
                                            </div>
                                        </div>

                                        {isRegistered &&
                                            getRoles().length > 0 && (
                                                <div className="p-4 border-b border-gray-200">
                                                    <div className="text-sm font-semibold text-gray-700 mb-2">
                                                        Roles
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {getRoles().map(
                                                            (role, index) => (
                                                                <span
                                                                    key={index}
                                                                    className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full font-medium"
                                                                >
                                                                    {role}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                        {!isRegistered && (
                                            <div className="p-4 border-b border-gray-200">
                                                <div className="text-sm font-semibold text-gray-700 mb-2">
                                                    Registration Status
                                                </div>
                                                <div className="text-xs text-gray-600 mb-3">
                                                    This account is not
                                                    registered. Register to use
                                                    the platform features.
                                                </div>
                                                <button
                                                    onClick={handleRegister}
                                                    disabled={
                                                        isRegistering ||
                                                        isUserLoading ||
                                                        !contract
                                                    }
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                                                >
                                                    {isRegistering ||
                                                    isUserLoading
                                                        ? "Registering..."
                                                        : "Register Account"}
                                                </button>
                                                {!contract && (
                                                    <div className="mt-2 text-xs text-gray-500">
                                                        Waiting for contract to
                                                        load...
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {availableAccounts.length > 1 && (
                                            <div className="p-4">
                                                <div className="text-sm font-semibold text-gray-700 mb-2">
                                                    Switch Account
                                                </div>
                                                <select
                                                    value={currentAccount || ""}
                                                    onChange={(e) =>
                                                        handleSwitchAccount(
                                                            e.target.value
                                                        )
                                                    }
                                                    disabled={isSwitching}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                >
                                                    {availableAccounts.map(
                                                        (acc, index) => (
                                                            <option
                                                                key={acc}
                                                                value={acc}
                                                            >
                                                                Account{" "}
                                                                {index + 1}:{" "}
                                                                {formatAddress(
                                                                    acc
                                                                )}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                                {isSwitching && (
                                                    <div className="mt-2 text-xs text-gray-500">
                                                        Switching...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};
