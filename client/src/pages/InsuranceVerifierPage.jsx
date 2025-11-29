import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { InsuranceVerifierDashboard } from "../components/InsuranceVerifierDashboard";
import { useContract } from "../hooks/useContract";
import { useUser } from "../hooks/useUser";
import { CONTRACT_ADDRESS } from "../constants/config";

export const InsuranceVerifierPage = () => {
    const { contract, loadContract, isLoaded } = useContract();
    const { isRegistered, isInsuranceVerifier } = useUser(contract);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const initialize = async () => {
            if (!isLoaded) {
                const contractAddressToLoad =
                    CONTRACT_ADDRESS || localStorage.getItem("contractAddress");
                if (contractAddressToLoad) {
                    await loadContract(contractAddressToLoad);
                }
            }
            setIsInitializing(false);
        };
        initialize();
    }, [isLoaded, loadContract]);

    const log = () => {};

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isRegistered) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <p className="text-yellow-800">
                            Please register your account to access the Insurance
                            Verifier dashboard.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isInsuranceVerifier) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <p className="text-red-800">
                            You do not have Insurance Verifier permissions. This
                            page is only accessible to Insurance Verifiers.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Insurance Verifier Dashboard
                    </h1>
                    <p className="text-gray-600">
                        Review and verify insurance documents for car listings
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <InsuranceVerifierDashboard contract={contract} log={log} />
                </div>
            </div>
        </div>
    );
};
