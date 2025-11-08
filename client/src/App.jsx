import React, { useState } from "react";
import Web3 from "web3";

const RPC_URL = "http://127.0.0.1:8545"; // adjust if needed

export default function App() {
    const [web3, setWeb3] = useState(null);
    const [account, setAccount] = useState("-");
    const [chainId, setChainId] = useState("-");
    const [status, setStatus] = useState("Not loaded");
    const [contractAddr, setContractAddr] = useState("");
    const [contract, setContract] = useState(null);
    const [storeInput, setStoreInput] = useState("");
    const [currentValue, setCurrentValue] = useState("-");
    const [log, setLog] = useState("App ready — click Init RPC (Ganache)\n");

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

            const res = await fetch("/Storage.json");
            const artifact = await res.json();
            const abi = artifact.abi;
            const c = new web3.eth.Contract(abi, contractAddr);
            setContract(c);
            setStatus("Loaded");
            append(`Contract loaded at ${contractAddr}`);
        } catch (e) {
            append(`Load contract error: ${e.message}`);
        }
    };

    const callStore = async () => {
        try {
            if (!contract) return append("Load contract first");
            const from = account;
            const n = Number(storeInput);
            await contract.methods.store(n).send({ from, gas: 50_000 });
            append(`store(${n}) sent from ${from}`);
        } catch (e) {
            append(`store() error: ${e.message}`);
        }
    };

    const callRetrieve = async () => {
        try {
            if (!contract) return append("Load contract first");
            const v = await contract.methods.retrieve().call();
            setCurrentValue(String(v));
            append(`retrieve() -> ${v}`);
        } catch (e) {
            append(`retrieve() error: ${e.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        Simple Storage DApp
                    </h1>
                    <p className="text-gray-600">
                        Interact with your smart contract
                    </p>
                </div>

                <section className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                        RPC Connection
                    </h2>
                    <button
                        id="connectBtn"
                        onClick={initRpc}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                    >
                        Init RPC (Ganache)
                    </button>
                    <div className="mt-4 space-y-2 font-mono text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="font-semibold text-gray-700">
                                Default From (Account):
                            </span>{" "}
                            <span
                                id="account"
                                className="text-blue-600 break-all"
                            >
                                {account}
                            </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="font-semibold text-gray-700">
                                ChainId:
                            </span>{" "}
                            <span id="network" className="text-blue-600">
                                {chainId}
                            </span>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        Make sure{" "}
                        <code className="bg-yellow-100 px-1.5 py-0.5 rounded text-gray-800">
                            ganache
                        </code>{" "}
                        is running at{" "}
                        <code className="bg-yellow-100 px-1.5 py-0.5 rounded text-gray-800">
                            {RPC_URL}
                        </code>
                        .
                    </p>
                </section>

                <section className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                        Contract
                    </h2>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Contract address
                        </label>
                        <div className="flex gap-3 flex-wrap">
                            <input
                                id="contractAddress"
                                className="flex-1 min-w-[300px] font-mono text-sm border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="0x..."
                                value={contractAddr}
                                onChange={(e) =>
                                    setContractAddr(e.target.value)
                                }
                            />
                            <button
                                id="initBtn"
                                onClick={loadContract}
                                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg whitespace-nowrap"
                            >
                                Load Contract
                            </button>
                        </div>
                    </div>
                    <div className="font-mono text-sm bg-gray-50 p-3 rounded-lg">
                        Status:{" "}
                        <span
                            id="contractStatus"
                            className="font-semibold text-gray-800"
                        >
                            {status}
                        </span>
                    </div>
                </section>

                <section className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                        Contract Methods
                    </h2>
                    <div className="flex gap-3 flex-wrap mb-4">
                        <input
                            id="storeInput"
                            type="number"
                            placeholder="Enter number"
                            value={storeInput}
                            onChange={(e) => setStoreInput(e.target.value)}
                            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
                        />
                        <button
                            id="storeBtn"
                            onClick={callStore}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                        >
                            store()
                        </button>
                        <button
                            id="retrieveBtn"
                            onClick={callRetrieve}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                        >
                            retrieve()
                        </button>
                    </div>
                    <div className="font-mono text-sm bg-gray-50 p-3 rounded-lg">
                        Current value:{" "}
                        <span
                            id="currentValue"
                            className="font-semibold text-green-600 text-lg"
                        >
                            {currentValue}
                        </span>
                    </div>
                </section>

                <section className="bg-white rounded-2xl shadow-xl p-6">
                    <h3 className="text-2xl font-semibold text-gray-800 mb-4">
                        Log
                    </h3>
                    <div
                        id="log"
                        className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap border border-gray-700"
                    >
                        {log}
                    </div>
                </section>
            </div>
        </div>
    );
}
