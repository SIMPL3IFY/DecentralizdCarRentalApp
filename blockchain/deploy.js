// Usage: node deploy.js

const Web3 = require("web3").default;
const CarRentalABI = require("./build/contracts/CarRental.json").abi;

// Connect to Ganache
const web3 = new Web3("http://127.0.0.1:8545");

async function deployInfo() {
    try {
        const accounts = await web3.eth.getAccounts();
        console.log("Available accounts:", accounts.length);
        console.log("Deployer account:", accounts[0]);
        console.log(
            "Balance:",
            web3.utils.fromWei(await web3.eth.getBalance(accounts[0]), "ether"),
            "ETH"
        );

        const contractAddress = process.env.CONTRACT_ADDRESS;

        if (contractAddress) {
            console.log("\nContract Address:", contractAddress);
            const contract = new web3.eth.Contract(
                CarRentalABI,
                contractAddress
            );

            try {
                const contractOwner = await contract.methods
                    .contractOwner()
                    .call();
                console.log("Contract Owner:", contractOwner);
            } catch (error) {
                console.log(
                    "Could not read contract. Make sure it's deployed and address is correct."
                );
            }
        } else {
            console.log(
                "\n⚠️  No contract address set. Deploy the contract first using 'truffle migrate'"
            );
            console.log(
                "Then set CONTRACT_ADDRESS environment variable or update this script."
            );
        }
    } catch (error) {
        console.error("Error:", error.message);
        console.log("\nMake sure Ganache is running on port 8545");
    }
}
deployInfo();
