import React from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";

export const HomePage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center">
                    <h1 className="text-5xl font-bold text-gray-900 mb-6">
                        Decentralized Car Rental
                    </h1>
                    <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
                        Rent or list your car on the blockchain. Secure,
                        transparent, and powered by smart contracts.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/rent"
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors shadow-lg"
                        >
                            Rent a Car
                        </Link>
                        <Link
                            to="/list"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors shadow-lg"
                        >
                            List Your Car
                        </Link>
                    </div>
                </div>
              
            </div>
        </div>
    );
};
