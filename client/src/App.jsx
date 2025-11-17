import React, { useState, useEffect } from "react";
import Web3 from "web3";

const RPC_URL = "http://127.0.0.1:8545";

export default function App() {
    const [web3, setWeb3] = useState(null);
    const [account, setAccount] = useState("-");
    const [chainId, setChainId] = useState("-");
    const [contractAddr, setContractAddr] = useState("");
    const [contract, setContract] = useState(null);
    const [log, setLog] = useState("App ready — click Init RPC (Ganache)\n");
    const [activeTab, setActiveTab] = useState("owner"); // "owner" or "renter"
    const [userType, setUserType] = useState(null); // "owner" or "renter" or null
    const [userInfo, setUserInfo] = useState(null);
    const [insuranceStatus, setInsuranceStatus] = useState(null);
    const [isInsuranceVerifier, setIsInsuranceVerifier] = useState(false);
    const [verifyRenterAddress, setVerifyRenterAddress] = useState("");

    // Owner states
    const [cars, setCars] = useState([]);
    const [ownerBookings, setOwnerBookings] = useState([]);
    const [newCar, setNewCar] = useState({
        make: "",
        model: "",
        year: "",
        location: "",
        dailyRate: "",
    });

    // Renter states
    const [availableCars, setAvailableCars] = useState([]);
    const [renterBookings, setRenterBookings] = useState([]);
    const [bookingForm, setBookingForm] = useState({
        carId: "",
        startDate: "",
        endDate: "",
    });

    // Registration states - separate for owner and renter
    const [ownerRegUsername, setOwnerRegUsername] = useState("");
    const [ownerRegPassword, setOwnerRegPassword] = useState("");
    const [renterRegUsername, setRenterRegUsername] = useState("");
    const [renterRegPassword, setRenterRegPassword] = useState("");

    const append = (s) => setLog((x) => x + s + "\n");

    const initRpc = async () => {
        try {
            append(`Connecting to Ganache RPC at ${RPC_URL} ...`);
            const w3 = new Web3(RPC_URL);
            setWeb3(w3);

            const [cid, accs] = await Promise.all([
                w3.eth.getChainId(),
                w3.eth.getAccounts(),
            ]);

            append("Web3 module loaded");
            append(`ChainId: ${cid}`);
            setChainId(String(cid));
            if (accs.length) {
                setAccount(accs[0]);
                append(`RPC connected. defaultFrom=${accs[0]}`);
            } else {
                append("No accounts from RPC");
            }
        } catch (e) {
            append(`RPC error: ${e.message}`);
        }
    };

    const loadContract = async () => {
        try {
            if (!web3) return append("Initialize RPC first");
            if (!contractAddr) return append("Enter contract address");

            const res = await fetch("/CarRental.json");
            const artifact = await res.json();
            const abi = artifact.abi;
            const c = new web3.eth.Contract(abi, contractAddr);
            setContract(c);
            append(`Contract loaded at ${contractAddr}`);
            checkUserRegistration();
        } catch (e) {
            append(`Load contract error: ${e.message}`);
        }
    };

    const checkUserRegistration = async () => {
        if (!contract || !account || account === "-") return;
        try {
            const ownerInfo = await contract.methods.getOwner(account).call();
            const renterInfo = await contract.methods.getRenter(account).call();

            if (ownerInfo.isRegistered) {
                setUserType("owner");
                setUserInfo(ownerInfo);
                append(`Owner registered: ${ownerInfo.username}`);
                loadOwnerData();
            } else if (renterInfo.isRegistered) {
                setUserType("renter");
                setUserInfo(renterInfo);
                append(`Renter registered: ${renterInfo.username}`);
                loadRenterData();
            } else {
                setUserType(null);
                setUserInfo(null);
            }
        } catch (e) {
            append(`Check registration error: ${e.message}`);
        }
    };

    const registerOwner = async () => {
        try {
            if (!contract) return append("Load contract first");
            if (!ownerRegUsername || !ownerRegPassword)
                return append("Enter username and password");

            const passwordHash = web3.utils.keccak256(ownerRegPassword);
            await contract.methods
                .registerOwner(ownerRegUsername, passwordHash)
                .send({ from: account, gas: 500000 });
            append(`Owner registered: ${ownerRegUsername}`);
            setOwnerRegUsername("");
            setOwnerRegPassword("");
            checkUserRegistration();
        } catch (e) {
            append(`Register owner error: ${e.message}`);
        }
    };

    const registerRenter = async () => {
        try {
            if (!contract) return append("Load contract first");
            if (!renterRegUsername || !renterRegPassword)
                return append("Enter username and password");

            const passwordHash = web3.utils.keccak256(renterRegPassword);
            await contract.methods
                .registerRenter(renterRegUsername, passwordHash)
                .send({ from: account, gas: 500000 });
            append(`Renter registered: ${renterRegUsername}`);
            setRenterRegUsername("");
            setRenterRegPassword("");
            checkUserRegistration();
        } catch (e) {
            append(`Register renter error: ${e.message}`);
        }
    };

    const listCar = async () => {
        try {
            if (!contract) return append("Load contract first");
            if (!newCar.make || !newCar.model || !newCar.dailyRate)
                return append("Fill all required fields");

            const dailyRateWei = web3.utils.toWei(newCar.dailyRate, "ether");
            await contract.methods
                .listCar(
                    newCar.make,
                    newCar.model,
                    newCar.year || "2020",
                    newCar.location || "Unknown",
                    dailyRateWei
                )
                .send({ from: account, gas: 1000000 });

            append(`Car listed: ${newCar.make} ${newCar.model}`);
            setNewCar({
                make: "",
                model: "",
                year: "",
                location: "",
                dailyRate: "",
            });
            loadOwnerData();
        } catch (e) {
            append(`List car error: ${e.message}`);
        }
    };

    const loadOwnerData = async () => {
        if (!contract) return;
        try {
            const ownerInfo = await contract.methods.getOwner(account).call();
            setUserInfo(ownerInfo);
            
            // Load owner's cars
            const ownerCars = [];
            // Check up to 50 cars (adjust if needed)
            for (let i = 1; i <= 50; i++) {
                try {
                    const carBasic = await contract.methods.getCarBasic(i).call();
                    if (carBasic.owner && carBasic.owner.toLowerCase() === account.toLowerCase()) {
                        const carRental = await contract.methods.getCarRental(i).call();
                        ownerCars.push({ carId: i, ...carBasic, ...carRental });
                    }
                } catch (e) {
                    // Car doesn't exist, skip
                }
            }
            setCars(ownerCars);
            append(`Loaded ${ownerCars.length} car(s) for this owner`);
        } catch (e) {
            append(`Load owner data error: ${e.message}`);
        }
    };

    const loadAvailableCars = async () => {
        if (!contract) return;
        try {
            // In a real app, you'd have a function to get all cars
            // For now, we'll use a simple approach - try to get cars by ID
            const cars = [];
            for (let i = 1; i <= 10; i++) {
                try {
                    const car = await contract.methods.getCarBasic(i).call();
                    if (car.owner && car.owner !== "0x0000000000000000000000000000000000000000") {
                        const rental = await contract.methods
                            .getCarRental(i)
                            .call();
                        if (rental.isListed && rental.isAvailable) {
                            cars.push({ carId: i, ...car, ...rental });
                        }
                    }
                } catch (e) {
                    // Car doesn't exist, skip
                }
            }
            setAvailableCars(cars);
            append(`Loaded ${cars.length} available cars`);
        } catch (e) {
            append(`Load cars error: ${e.message}`);
        }
    };

    const loadRenterData = async () => {
        if (!contract) return;
        try {
            const renterInfo = await contract.methods.getRenter(account).call();
            setUserInfo(renterInfo);

            // Check insurance status
            try {
                const insurance = await contract.methods
                    .insuranceRecords(account)
                    .call();
                setInsuranceStatus({
                    isVerified: insurance.isVerified,
                    isRevoked: insurance.isRevoked,
                });
            } catch (e) {
                setInsuranceStatus({ isVerified: false, isRevoked: false });
            }

            // Check if current account is insurance verifier
            try {
                const isVerifier = await contract.methods
                    .insuranceVerifiers(account)
                    .call();
                setIsInsuranceVerifier(isVerifier);
            } catch (e) {
                setIsInsuranceVerifier(false);
            }

            loadAvailableCars();
        } catch (e) {
            append(`Load renter data error: ${e.message}`);
        }
    };

    const bookCar = async () => {
        try {
            if (!contract) return append("Load contract first");
            if (
                !bookingForm.carId ||
                !bookingForm.startDate ||
                !bookingForm.endDate
            ) {
                return append("Fill all booking fields");
            }

            // Check insurance before attempting to book
            try {
                const insurance = await contract.methods
                    .insuranceRecords(account)
                    .call();
                if (!insurance.isVerified || insurance.isRevoked) {
                    return append(
                        "❌ ERROR: Insurance not verified! You must have verified insurance to book a car. Contact an Insurance Verifier."
                    );
                }
            } catch (e) {
                return append(
                    "❌ ERROR: Could not check insurance status. " + e.message
                );
            }

            const car = await contract.methods
                .getCarRental(bookingForm.carId)
                .call();
            const startTimestamp = Math.floor(
                new Date(bookingForm.startDate).getTime() / 1000
            );
            const endTimestamp = Math.floor(
                new Date(bookingForm.endDate).getTime() / 1000
            );

            // Validate dates
            if (startTimestamp >= endTimestamp) {
                return append("❌ ERROR: Start date must be before end date");
            }
            if (startTimestamp < Math.floor(Date.now() / 1000)) {
                return append("❌ ERROR: Start date must be in the future");
            }

            const days = Math.ceil((endTimestamp - startTimestamp) / 86400);
            const totalCost = BigInt(car.dailyRate) * BigInt(days);

            await contract.methods
                .bookCar(bookingForm.carId, startTimestamp, endTimestamp)
                .send({
                    from: account,
                    gas: 1000000,
                    value: totalCost.toString(),
                });

            append(
                `✅ Car booked successfully! Booking ID will be shown in transaction receipt`
            );
            setBookingForm({ carId: "", startDate: "", endDate: "" });
            loadRenterData();
        } catch (e) {
            let errorMsg = `❌ Book car error: ${e.message}`;
            if (e.message.includes("Insurance not verified")) {
                errorMsg +=
                    "\n⚠️ You need verified insurance to book a car. Contact an Insurance Verifier.";
            } else if (e.message.includes("reverted")) {
                errorMsg +=
                    "\n⚠️ Transaction was reverted. Common reasons:\n  - Insurance not verified\n  - Car not available\n  - Invalid dates\n  - Insufficient payment";
            }
            append(errorMsg);
        }
    };

    const withdrawEarnings = async () => {
        try {
            if (!contract) return append("Load contract first");
            await contract.methods
                .withdrawEarnings()
                .send({ from: account, gas: 200000 });
            append("Earnings withdrawn");
            checkUserRegistration();
        } catch (e) {
            append(`Withdraw earnings error: ${e.message}`);
        }
    };

    const removeCar = async (carId) => {
        try {
            if (!contract) return append("Load contract first");
            await contract.methods
                .removeCar(carId)
                .send({ from: account, gas: 200000 });
            append(`✅ Car #${carId} removed successfully`);
            loadOwnerData(); // Refresh the list
        } catch (e) {
            let errorMsg = `❌ Remove car error: ${e.message}`;
            if (e.message.includes("Cannot remove car with active bookings")) {
                errorMsg += "\n⚠️ This car has active bookings and cannot be removed.";
            } else if (e.message.includes("Not the car owner")) {
                errorMsg += "\n⚠️ You are not the owner of this car.";
            }
            append(errorMsg);
        }
    };

    const verifyInsurance = async (renterAddress) => {
        try {
            if (!contract) return append("Load contract first");
            await contract.methods
                .verifyInsurance(renterAddress)
                .send({ from: account, gas: 200000 });
            append(`✅ Insurance verified for ${renterAddress}`);
            if (renterAddress.toLowerCase() === account.toLowerCase()) {
                loadRenterData();
            }
        } catch (e) {
            append(`Verify insurance error: ${e.message}`);
        }
    };

    useEffect(() => {
        if (contract && account !== "-") {
            checkUserRegistration();
        }
    }, [contract, account]);

    // Load owner data when owner tab is active
    useEffect(() => {
        if (activeTab === "owner" && userType === "owner" && contract) {
            loadOwnerData();
        }
    }, [activeTab, userType, contract]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        🚗 Decentralized Car Rental DApp
                    </h1>
                    <p className="text-gray-600">
                        Rent or list your car on the blockchain
                    </p>
                </div>

                {/* Connection Section */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                        Connection & Contract
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <button
                        onClick={initRpc}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg"
                    >
                        Init RPC (Ganache)
                    </button>
                        <div className="space-y-2">
                            <input
                                type="text"
                                placeholder="Contract address (0x...)"
                                value={contractAddr}
                                onChange={(e) =>
                                    setContractAddr(e.target.value)
                                }
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={loadContract}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg"
                            >
                                Load Contract
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="font-semibold">Account: </span>
                            <span className="text-blue-600 break-all">
                                {account}
                        </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="font-semibold">ChainId: </span>
                            <span className="text-blue-600">{chainId}</span>
                        </div>
                    </div>
                </div>

                {/* Registration Section */}
                {!userType && contract && (
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                            Register Account
                    </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-indigo-600">
                                    Register as Owner
                                </h3>
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={ownerRegUsername}
                                    onChange={(e) =>
                                        setOwnerRegUsername(e.target.value)
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                />
                        <input
                                    type="password"
                                    placeholder="Password"
                                    value={ownerRegPassword}
                                    onChange={(e) =>
                                        setOwnerRegPassword(e.target.value)
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        />
                        <button
                                    onClick={registerOwner}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                        >
                                    Register as Owner
                        </button>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-purple-600">
                                    Register as Renter
                                </h3>
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={renterRegUsername}
                                    onChange={(e) =>
                                        setRenterRegUsername(e.target.value)
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={renterRegPassword}
                                    onChange={(e) =>
                                        setRenterRegPassword(e.target.value)
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                />
                        <button
                                    onClick={registerRenter}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                        >
                                    Register as Renter
                        </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Tabs */}
                {userType && (
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

                        {/* Owner Tab */}
                        {activeTab === "owner" && userType === "owner" && (
                            <div className="space-y-6">
                                <div className="bg-indigo-50 p-4 rounded-lg">
                                    <h3 className="font-semibold text-indigo-800 mb-2">
                                        Owner Info
                                    </h3>
                                    <p>
                                        Username: {userInfo?.username || "N/A"}
                                    </p>
                                    <p>
                                        Total Earnings:{" "}
                                        {userInfo
                                            ? web3?.utils.fromWei(
                                                  userInfo.totalEarnings,
                                                  "ether"
                                              )
                                            : "0"}{" "}
                                        ETH
                                    </p>
                                    <p>
                                        Withdrawable:{" "}
                                        {userInfo
                                            ? web3?.utils.fromWei(
                                                  userInfo.withdrawableEarnings,
                                                  "ether"
                                              )
                                            : "0"}{" "}
                                        ETH
                                    </p>
                                    {userInfo?.withdrawableEarnings > 0 && (
                                        <button
                                            onClick={withdrawEarnings}
                                            className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                                        >
                                            Withdraw Earnings
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-xl font-semibold mb-4">
                                        List a Car
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input
                                            type="text"
                                            placeholder="Make (e.g., Toyota)"
                                            value={newCar.make}
                                            onChange={(e) =>
                                                setNewCar({
                                                    ...newCar,
                                                    make: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Model (e.g., Camry)"
                                            value={newCar.model}
                                            onChange={(e) =>
                                                setNewCar({
                                                    ...newCar,
                                                    model: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Year"
                                            value={newCar.year}
                                            onChange={(e) =>
                                                setNewCar({
                                                    ...newCar,
                                                    year: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Location"
                                            value={newCar.location}
                                            onChange={(e) =>
                                                setNewCar({
                                                    ...newCar,
                                                    location: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Daily Rate (ETH)"
                                            value={newCar.dailyRate}
                                            onChange={(e) =>
                                                setNewCar({
                                                    ...newCar,
                                                    dailyRate: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                    </div>
                                    <button
                                        onClick={listCar}
                                        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg"
                                    >
                                        List Car
                                    </button>
                                </div>

                                {/* Owner's Cars List */}
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-semibold">
                                            My Listed Cars
                                        </h3>
                                        <button
                                            onClick={loadOwnerData}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
                                        >
                                            Refresh List
                                        </button>
                                    </div>
                                    {cars.length === 0 ? (
                                        <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                                            No cars listed yet. List a car above to get started!
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {cars.map((car) => (
                                                <div
                                                    key={car.carId}
                                                    className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <p className="font-semibold text-lg">
                                                                    {car.make} {car.model} ({car.year})
                                                                </p>
                                                                {car.isListed ? (
                                                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                                                        Listed
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                                                        Removed
                                                                    </span>
                                                                )}
                                                                {car.isAvailable ? (
                                                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                                                        Available
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                                                        Booked
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600 mb-1">
                                                                Location: {car.location}
                                                            </p>
                                                            <p className="text-sm text-gray-600 mb-1">
                                                                Daily Rate: {web3?.utils.fromWei(car.dailyRate, "ether")} ETH
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                Car ID: {car.carId} | Total Bookings: {car.totalBookings}
                                                            </p>
                                                        </div>
                                                        {car.isListed && car.isAvailable && (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm(`Are you sure you want to remove ${car.make} ${car.model}?`)) {
                                                                        removeCar(car.carId);
                                                                    }
                                                                }}
                                                                className="ml-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Renter Tab */}
                        {activeTab === "renter" && (
                            <div className="space-y-6">
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <h3 className="font-semibold text-purple-800 mb-2">
                                        Renter Info
                                    </h3>
                                    <p>
                                        Username: {userInfo?.username || "N/A"}
                                    </p>
                                    <p>
                                        Total Bookings:{" "}
                                        {userInfo?.totalBookings || "0"}
                                    </p>
                                    <div className="mt-3 p-3 bg-white rounded-lg">
                                        <p className="font-semibold mb-1">
                                            Insurance Status:
                                        </p>
                                        {insuranceStatus?.isVerified &&
                                        !insuranceStatus?.isRevoked ? (
                                            <p className="text-green-600">
                                                ✅ Verified
                                            </p>
                                        ) : insuranceStatus?.isRevoked ? (
                                            <p className="text-red-600">
                                                ❌ Revoked
                                            </p>
                                        ) : (
                                            <p className="text-orange-600">
                                                ⚠️ Not Verified - You need
                                                verified insurance to book a car
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={loadAvailableCars}
                                        className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                                    >
                                        Refresh Available Cars
                                    </button>
                                </div>

                                {/* Insurance Verifier Section */}
                                {isInsuranceVerifier && (
                                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                                        <h3 className="font-semibold text-blue-800 mb-3">
                                            🔐 Insurance Verifier Panel
                                        </h3>
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Renter address (0x...)"
                                                value={verifyRenterAddress}
                                                onChange={(e) =>
                                                    setVerifyRenterAddress(
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                            />
                                            <button
                                                onClick={() =>
                                                    verifyInsurance(
                                                        verifyRenterAddress
                                                    )
                                                }
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                                            >
                                                Verify Insurance
                                            </button>
                                            <p className="text-sm text-gray-600">
                                                Enter a renter's address to
                                                verify their insurance
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-xl font-semibold mb-4">
                                        Available Cars
                                    </h3>
                                    <div className="space-y-4">
                                        {availableCars.map((car, idx) => (
                                            <div
                                                key={idx}
                                                className="border rounded-lg p-4 bg-gray-50"
                                            >
                                                <p className="font-semibold">
                                                    {car.make} {car.model} (
                                                    {car.year})
                                                </p>
                                                <p>Location: {car.location}</p>
                                                <p>
                                                    Daily Rate:{" "}
                                                    {web3?.utils.fromWei(
                                                        car.dailyRate,
                                                        "ether"
                                                    )}{" "}
                                                    ETH
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Car ID: {car.carId}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-semibold mb-4">
                                        Book a Car
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input
                                            type="text"
                                            placeholder="Car ID"
                                            value={bookingForm.carId}
                                            onChange={(e) =>
                                                setBookingForm({
                                                    ...bookingForm,
                                                    carId: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                        <input
                                            type="date"
                                            value={bookingForm.startDate}
                                            onChange={(e) =>
                                                setBookingForm({
                                                    ...bookingForm,
                                                    startDate: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                        <input
                                            type="date"
                                            value={bookingForm.endDate}
                                            onChange={(e) =>
                                                setBookingForm({
                                                    ...bookingForm,
                                                    endDate: e.target.value,
                                                })
                                            }
                                            className="border border-gray-300 rounded-lg px-4 py-2"
                                        />
                                    </div>
                                    <button
                                        onClick={bookCar}
                                        className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg"
                                    >
                                        Book Car
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Log Section */}
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
