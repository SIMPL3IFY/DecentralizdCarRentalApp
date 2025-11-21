import React from "react";
import { useUser } from "../hooks/useUser";
import { contractService } from "../services/contractService";
import { web3Service } from "../services/web3Service";

export const RegistrationPanel = ({ contract, log }) => {
    const { isRegistered, isLoading, register, checkRegistration } =
        useUser(contract);

    const handleRegister = async () => {
        log("Registering...");
        const result = await register();
        if (result.success) {
            log("Registered");
        } else {
            log(`Error: ${result.error}`);
            if (result.error && result.error.includes("already")) {
                log("May already be registered. Checking...");
                setTimeout(async () => {
                    log("Checking status...");
                    await checkRegistration();
                }, 1000);
            }
        }
    };

    const handleCheckStatus = async () => {
        log("=== Status Check ===");
        try {
            const account = web3Service.getAccount();
            log(`Account: ${account}`);

            if (!account) {
                log("No account found");
                return;
            }

            const registered = await contractService.isRegistered();
            log(`Contract: ${registered ? "REGISTERED" : "NOT REGISTERED"}`);

            try {
                const contract = contractService.getContract();
                const user = await contract.methods.users(account).call();
                log(`User: {registered: ${user.registered}}`);
            } catch (e) {
                log(`Could not read user: ${e.message}`);
            }

            await checkRegistration();

            if (registered) {
                log("Registered! Dashboard should appear.");
                log("If not, try refreshing.");
            } else {
                log("NOT registered.");
                log("If you got 'already registered' error:");
                log("   - Transaction may have reverted");
                log("   - Different account?");
                log("   - Contract state reset?");
                log("Try Register again.");
            }
        } catch (error) {
            log(`Error: ${error.message}`);
            console.error("Registration check error:", error);
        }
    };

    if (isRegistered) {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                    Registration Status
                </h2>
                <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-green-800 font-semibold">
                        You are registered
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Register Account
            </h2>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-blue-800 text-sm mb-2">
                    Register to use the car sharing platform. No username or
                    password needed - just connect your wallet.
                </p>
            </div>
            <div className="space-y-2">
                <button
                    onClick={handleRegister}
                    disabled={isLoading || !contract}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                    {isLoading ? "Registering..." : "Register"}
                </button>
                <button
                    onClick={handleCheckStatus}
                    disabled={isLoading || !contract}
                    className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                    Check Registration Status
                </button>
            </div>
        </div>
    );
};
