Car Rental DApp - Quick Start Guide

Prerequisites

1. Ganache running on port 8545
2. CarRental contract deployed to Ganache
3. Node.js\* installed

Step-by-Step Setup

1. Start Ganache

In a terminal, run:

ganache -p 8545

Keep this terminal open.

2. Deploy the Contract

In another terminal:

cd /workspaces/DecentralizdCarRentalApp/blockchain
truffle migrate

Important!!: Copy the CarRental contract address from the deployment output.

3. Start the Frontend

In a new terminal:

cd /workspaces/DecentralizdCarRentalApp/client
npm install # Only needed first time
npm run dev

The app will start on `http://localhost:5173`

4. Use the DApp

1. Open `http://localhost:5173` in your browser
1. Click "Init RPC (Ganache)" to connect
1. Paste your contract addressand click "Load Contract"
1. Register as either an Owner or Renter
1. Start using the features!

Features

Owner Features

-   Register account
-   List cars for rent
-   View earnings
-   Withdraw earnings

Renter Features

-   Register account
-   Browse available cars
-   Book cars
-   View booking history

Troubleshooting

"Could not connect to RPC"

-   Make sure Ganache is running on port 8545
-   Check that the RPC URL is correct

"Contract not found"

-   Verify the contract address is correct
-   Make sure the contract was deployed successfully
-   Check that `CarRental.json` exists in `client/public/`

"Transaction failed"

-   Check that you have enough ETH in your account
-   Verify the gas limit is sufficient
-   Check the browser console for detailed errors

Development

-   Frontend runs on: `http://localhost:5173`
-   Ganache RPC: `http://127.0.0.1:8545`
-   Contract ABI: `client/public/CarRental.json`
