const CarRental = artifacts.require("CarRental");

// Sample car data
const sampleCars = [
    {
        dailyPrice: "0.05", // ETH
        deposit: "0.5", // ETH
        insuranceDocURI: "ipfs://insurance-toyota-camry.pdf",
        make: "Toyota",
        model: "Camry",
        year: 2020,
        location: "New York, NY",
    },
    {
        dailyPrice: "0.08",
        deposit: "0.8",
        insuranceDocURI: "ipfs://insurance-tesla-model3.pdf",
        make: "Tesla",
        model: "Model 3",
        year: 2022,
        location: "San Francisco, CA",
    },
    {
        dailyPrice: "0.06",
        deposit: "0.6",
        insuranceDocURI: "ipfs://insurance-honda-accord.pdf",
        make: "Honda",
        model: "Accord",
        year: 2021,
        location: "Los Angeles, CA",
    },
    {
        dailyPrice: "0.12",
        deposit: "1.2",
        insuranceDocURI: "ipfs://insurance-bmw-x5.pdf",
        make: "BMW",
        model: "X5",
        year: 2023,
        location: "Miami, FL",
    },
    {
        dailyPrice: "0.04",
        deposit: "0.4",
        insuranceDocURI: "ipfs://insurance-ford-f150.pdf",
        make: "Ford",
        model: "F-150",
        year: 2019,
        location: "Austin, TX",
    },
];

async function seedData() {
    try {
        console.log("\n==========================================");
        console.log("Seeding Sample Car Listings");
        console.log("==========================================\n");

        // Get deployed contract
        const carRental = await CarRental.deployed();
        const accounts = await web3.eth.getAccounts();

        // Account assignments - accounts[8] gets first 2 cars, accounts[9] gets next 3 cars
        const insuranceVerifier = accounts[1];
        const carOwner1 = accounts[8]; // Will create listings for cars 0-1
        const carOwner2 = accounts[9]; // Will create listings for cars 2-4

        // Register car owners
        console.log("Registering car owners...");
        for (const owner of [carOwner1, carOwner2]) {
            try {
                await carRental.register({ from: owner });
                console.log(`   Registered: ${owner.slice(0, 10)}...`);
            } catch (error) {
                if (error.message.includes("already")) {
                    console.log(
                        `  - Already registered: ${owner.slice(0, 10)}...`
                    );
                } else {
                    console.log(`   Failed: ${error.message}`);
                }
            }
        }

        // Create listings
        console.log("\nCreating car listings...");
        const listingIds = [];

        // Helper function to create a listing
        const createListing = async (car, owner, accountLabel) => {
            try {
                const dailyPriceWei = web3.utils.toWei(car.dailyPrice, "ether");
                const depositWei = web3.utils.toWei(car.deposit, "ether");

                const tx = await carRental.createListing(
                    dailyPriceWei,
                    depositWei,
                    car.insuranceDocURI,
                    car.make,
                    car.model,
                    car.year,
                    car.location,
                    { from: owner }
                );

                const listingId = tx.logs
                    .find((l) => l.event === "ListingCreated")
                    .args.listingId.toNumber();
                listingIds.push(listingId);
                console.log(
                    `   Listing #${listingId} (${accountLabel}): ${car.make} ${car.model} (${car.year}) - ${car.location}`
                );
            } catch (error) {
                console.log(
                    `   Failed to create listing for ${car.make} ${car.model}: ${error.message}`
                );
            }
        };

        // Account[8] creates first 2 cars (indices 0-1)
        for (const car of sampleCars.slice(0, 2)) {
            await createListing(car, carOwner1, "Account[8]");
        }

        // Account[9] creates next 3 cars (indices 2-4)
        for (const car of sampleCars.slice(2, 5)) {
            await createListing(car, carOwner2, "Account[9]");
        }

        // Verify insurance
        console.log("\nVerifying insurance...");
        for (const listingId of listingIds) {
            try {
                await carRental.verifyInsurance(listingId, true, {
                    from: insuranceVerifier,
                });
                console.log(`Verified listing #${listingId}`);
            } catch (error) {
                console.log(
                    `Failed to verify listing #${listingId}: ${error.message}`
                );
            }
        }

        console.log("\n==========================================");
        console.log(`Successfully seeded ${listingIds.length} listings!`);
        console.log("==========================================\n");
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
}

module.exports = function (callback) {
    seedData()
        .then(() => callback())
        .catch((error) => callback(error));
};
