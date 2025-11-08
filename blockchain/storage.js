// storage.js
const Web3 = require("web3").default;

// Connect to Ethereum provider (update the URL if needed)
const web3 = new Web3("http://127.0.0.1:8545");

// Replace with your deployed contract's address
const contractAddress = "0xb84ce0c6246a22c686b15b435e20cb0646899917";

// Replace with your deployed contract's ABI
const contractABI = require("./build/contracts/Storage.json").abi;

// Create a contract instance
const storageContract = new web3.eth.Contract(contractABI, contractAddress);

// Example account (replace with a valid account from Ganache or your provider)
const account = "0x0762910eC9C2822FD5bd71a93f616B1D91a823e2";

// Function to store a number in the contract
async function storeNumber(number) {
    try {
        const tx = await storageContract.methods.store(number).send({
            from: account,
            gas: 50000,
            gasPrice: web3.utils.toWei("20", "gwei"),
        });

        console.log(
            `Stored ${number} in the contract. Transaction Hash: ${tx.transactionHash}`
        );
    } catch (error) {
        console.error("Error storing number:", error);
    }
}

// Function to retrieve the stored number
async function retrieveNumber() {
    try {
        const number = await storageContract.methods.retrieve().call();
        console.log(`Retrieved number from the contract: ${number}`);
    } catch (error) {
        console.error("Error retrieving number:", error);
    }
}

// Example usage
(async () => {
    // Store a number
    await storeNumber(42);

    // Retrieve the stored number
    await retrieveNumber();
})();
