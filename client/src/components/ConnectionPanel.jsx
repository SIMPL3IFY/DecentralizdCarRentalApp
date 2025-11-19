import React, { useState, useEffect } from "react";
import { web3Service } from "../services/web3Service";

export const ConnectionPanel = ({
    onWeb3Connected,
    onContractLoaded,
    log,
    onAccountSwitched,
    isInitializing = false,
    initError = null,
    isContractLoaded = false,
}) => {
    const [contractAddr, setContractAddr] = useState(
        localStorage.getItem("contractAddress") || ""
    );
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoadingContract, setIsLoadingContract] = useState(false);
    const [availableAccounts, setAvailableAccounts] = useState([]);
    const [isSwitching, setIsSwitching] = useState(false);

    const handleInitRPC = async () => {
        setIsConnecting(true);
        log("Connecting...");
        try {
            const result = await web3Service.init();
            if (result.success) {
                log(`Connected. Account: ${result.account}`);
                log(`ChainId: ${result.chainId}`);
                log(`Accounts: ${result.accounts?.length || 0}`);
                setAvailableAccounts(result.accounts || []);
                onWeb3Connected(result);
            } else {
                log(`Error: ${result.error}`);
            }
        } catch (error) {
            log(`Error: ${error.message}`);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSwitchAccount = async (newAccount) => {
        if (newAccount === web3Service.getAccount()) {
            return;
        }
        setIsSwitching(true);
        log(`Switching to ${newAccount}...`);
        try {
            await web3Service.switchAccount(newAccount);
            log(`Switched`);
            if (onAccountSwitched) {
                onAccountSwitched(newAccount);
            }
        } catch (error) {
            log(`Error: ${error.message}`);
        } finally {
            setIsSwitching(false);
        }
    };

    useEffect(() => {
        const loadAccounts = async () => {
            if (web3Service.isInitialized()) {
                const accounts = await web3Service.getAccounts();
                setAvailableAccounts(accounts);
            }
        };
        loadAccounts();
    }, []);

    const handleLoadContract = async () => {
        if (!web3Service.isInitialized()) {
            log("Initialize RPC first");
            return;
        }
        if (!contractAddr) {
            log("Enter contract address");
            return;
        }

        setIsLoadingContract(true);
        log(`Loading contract...`);
        try {
            const result = await onContractLoaded(contractAddr);
            if (result.success) {
                log(`Contract loaded`);
                localStorage.setItem("contractAddress", contractAddr);
            } else {
                log(`Error: ${result.error}`);
            }
        } catch (error) {
            log(`Error: ${error.message}`);
        } finally {
            setIsLoadingContract(false);
        }
    };

    const account = web3Service.getAccount();
    const chainId = web3Service.getChainId();

    const isWeb3Initialized = web3Service.isInitialized();

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Connection & Contract (For Development Debugging Only)
            </h2>

            {isInitializing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="text-blue-800 font-medium">
                            Initializing...
                        </span>
                    </div>
                </div>
            )}

            {initError && !isInitializing && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-800">
                        <strong>Error:</strong> {initError}
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                        Try manual initialization below
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div
                    className={`p-4 rounded-lg border-2 ${
                        isWeb3Initialized
                            ? "bg-green-50 border-green-300"
                            : "bg-gray-50 border-gray-300"
                    }`}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span
                            className={`text-2xl ${
                                isWeb3Initialized
                                    ? "text-green-600"
                                    : "text-gray-400"
                            }`}
                        >
                            {isWeb3Initialized ? "Yes" : "No"}
                        </span>
                        <span className="font-semibold text-sm">
                            Web3 Connection
                        </span>
                    </div>
                    <p className="text-xs text-gray-600">
                        {isWeb3Initialized ? "Connected" : "Not connected"}
                    </p>
                </div>
                <div
                    className={`p-4 rounded-lg border-2 ${
                        isContractLoaded
                            ? "bg-green-50 border-green-300"
                            : "bg-gray-50 border-gray-300"
                    }`}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span
                            className={`text-2xl ${
                                isContractLoaded
                                    ? "text-green-600"
                                    : "text-gray-400"
                            }`}
                        >
                            {isContractLoaded ? "Yes" : "No"}
                        </span>
                        <span className="font-semibold text-sm">Contract</span>
                    </div>
                    <p className="text-xs text-gray-600">
                        {isContractLoaded ? "Loaded" : "Not loaded"}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button
                    onClick={handleInitRPC}
                    disabled={isConnecting || isInitializing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg"
                >
                    {isConnecting ? "Connecting..." : "Reconnect RPC"}
                </button>
                <div className="space-y-2">
                    <input
                        type="text"
                        placeholder="Contract address (0x...)"
                        value={contractAddr}
                        onChange={(e) => setContractAddr(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleLoadContract}
                        disabled={
                            isLoadingContract ||
                            !web3Service.isInitialized() ||
                            isInitializing
                        }
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg"
                    >
                        {isLoadingContract
                            ? "Loading..."
                            : "Load/Reload Contract"}
                    </button>
                </div>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-semibold">Account: </span>
                        <span className="text-blue-600 break-all">
                            {account || "-"}
                        </span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-semibold">ChainId: </span>
                        <span className="text-blue-600">{chainId || "-"}</span>
                    </div>
                </div>
                {web3Service.isInitialized() &&
                    availableAccounts.length > 1 && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <label className="block font-semibold text-sm text-gray-700 mb-2">
                                Switch Account:
                            </label>
                            <select
                                value={account || ""}
                                onChange={(e) =>
                                    handleSwitchAccount(e.target.value)
                                }
                                disabled={isSwitching}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                {availableAccounts.map((acc, index) => (
                                    <option key={acc} value={acc}>
                                        Account {index + 1}: {acc.slice(0, 10)}
                                        ...{acc.slice(-8)}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-600 mt-1">
                                {availableAccounts.length > 0 && (
                                    <>
                                        Account 1 = Owner/Renter | Account 2 =
                                        Insurance Verifier | Account 3 =
                                        Arbitrator
                                    </>
                                )}
                            </p>
                        </div>
                    )}
            </div>
        </div>
    );
};
