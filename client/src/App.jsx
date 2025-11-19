import React, { useState, useEffect } from "react";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { RegistrationPanel } from "./components/RegistrationPanel";
import { OwnerDashboard } from "./components/OwnerDashboard";
import { RenterDashboard } from "./components/RenterDashboard";
import { InsuranceVerifierDashboard } from "./components/InsuranceVerifierDashboard";
import { ArbitratorDashboard } from "./components/ArbitratorDashboard";
import { useContract } from "./hooks/useContract";
import { useUser } from "./hooks/useUser";
import { web3Service } from "./services/web3Service";
import { contractService } from "./services/contractService";
import { CONTRACT_ADDRESS } from "./constants/config";

export default function App() {
    const [log, setLog] = useState("Initializing app...\n");
    const [activeTab, setActiveTab] = useState("owner");
    const [isInitializing, setIsInitializing] = useState(true);
    const [initError, setInitError] = useState(null);
    const [contractAddress, setContractAddress] = useState(null);

    const { contract, loadContract, isLoaded } = useContract();
    const {
        isRegistered,
        checkRegistration,
        isInsuranceVerifier,
        isArbitrator,
    } = useUser(contract);

    const append = (message) => {
        setLog((prev) => prev + message + "\n");
    };

    const onConnect = () => {
        // Web3 connected
    };

    const onSwitchAccount = async (newAccount) => {
        append(`Switched to: ${newAccount}`);
        append("Checking registration...");
        await checkRegistration();
    };

    const handleForceRefresh = async () => {
        append("Refreshing...");
        append(`Account: ${web3Service.getAccount()}`);
        try {
            const { contractService } = await import(
                "./services/contractService"
            );
            const registered = await contractService.isRegistered();
            append(
                `Contract check: ${
                    registered ? "REGISTERED" : "NOT REGISTERED"
                }`
            );
        } catch (e) {
            append(`Error: ${e.message}`);
        }
        await checkRegistration();
        append("Done");
    };

    useEffect(() => {
        const initializeApp = async () => {
            setIsInitializing(true);
            setInitError(null);

            try {
                append("Connecting...");
                const rpcResult = await web3Service.init();

                if (!rpcResult.success) {
                    throw new Error(`RPC failed: ${rpcResult.error}`);
                }

                append(`Connected`);
                append(`Account: ${rpcResult.account}`);
                append(`Chain ID: ${rpcResult.chainId}`);
                append(`Accounts: ${rpcResult.accounts?.length || 0}`);

                const contractAddressToLoad =
                    CONTRACT_ADDRESS || localStorage.getItem("contractAddress");

                setContractAddress(contractAddressToLoad);

                if (contractAddressToLoad) {
                    append(`Loading contract...`);
                    const contractResult = await loadContract(
                        contractAddressToLoad
                    );

                    if (contractResult.success) {
                        append(`Contract loaded`);
                        localStorage.setItem(
                            "contractAddress",
                            contractAddressToLoad
                        );
                        setContractAddress(
                            contractService.getContractAddress()
                        );
                    } else {
                        append(`Contract failed: ${contractResult.error}`);
                        setInitError(
                            `Contract load failed: ${contractResult.error}`
                        );
                    }
                } else {
                    append(`No contract address`);
                }
            } catch (error) {
                append(`Init error: ${error.message}`);
                setInitError(error.message);
            } finally {
                setIsInitializing(false);
            }
        };

        initializeApp();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isLoaded && web3Service.isInitialized()) {
            append("Checking registration...");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        Decentralized Car Rental DApp
                    </h1>
                    <p className="text-gray-600">
                        Rent or list your car on the blockchain using CarRental
                    </p>
                </div>

                <ConnectionPanel
                    onWeb3Connected={onConnect}
                    onAccountSwitched={onSwitchAccount}
                    log={append}
                    isInitializing={isInitializing}
                    initError={initError}
                    isContractLoaded={isLoaded}
                    contractAddress={
                        contractAddress || contractService.getContractAddress()
                    }
                />

                {isLoaded && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm">
                        <p className="text-yellow-800">
                            <strong>Debug:</strong> Contract Loaded: Yes |
                            Registration Status:{" "}
                            {isRegistered ? "REGISTERED" : "NOT REGISTERED"} |
                            Account: {web3Service.getAccount()?.slice(0, 10)}
                            ... |
                            <button
                                onClick={handleForceRefresh}
                                className="ml-2 text-blue-600 hover:text-blue-800 underline"
                            >
                                Force Refresh
                            </button>
                        </p>
                    </div>
                )}

                {isLoaded && !isRegistered && (
                    <RegistrationPanel contract={contract} log={append} />
                )}

                {isLoaded && isRegistered && (
                    <>
                        {isInsuranceVerifier && (
                            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                                <InsuranceVerifierDashboard
                                    contract={contract}
                                    log={append}
                                />
                            </div>
                        )}

                        {isArbitrator && (
                            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                                <ArbitratorDashboard
                                    contract={contract}
                                    log={append}
                                />
                            </div>
                        )}

                        {!isInsuranceVerifier && !isArbitrator && (
                            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                                <div className="flex space-x-4 mb-6 border-b">
                                    <button
                                        onClick={() => setActiveTab("owner")}
                                        className={`px-6 py-3 font-semibold transition-colors ${
                                            activeTab === "owner"
                                                ? "text-indigo-600 border-b-2 border-indigo-600"
                                                : "text-gray-500 hover:text-gray-700"
                                        }`}
                                    >
                                        Owner Dashboard
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("renter")}
                                        className={`px-6 py-3 font-semibold transition-colors ${
                                            activeTab === "renter"
                                                ? "text-purple-600 border-b-2 border-purple-600"
                                                : "text-gray-500 hover:text-gray-700"
                                        }`}
                                    >
                                        Renter Dashboard
                                    </button>
                                </div>

                                {activeTab === "owner" && (
                                    <OwnerDashboard
                                        contract={contract}
                                        log={append}
                                    />
                                )}

                                {activeTab === "renter" && (
                                    <RenterDashboard
                                        contract={contract}
                                        log={append}
                                    />
                                )}
                            </div>
                        )}
                    </>
                )}

                <div className="bg-white rounded-2xl shadow-xl p-6">
                    <h3 className="text-2xl font-semibold text-gray-800 mb-4">
                        Log
                    </h3>
                    <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                        {log}
                    </div>
                </div>
            </div>
        </div>
    );
}
