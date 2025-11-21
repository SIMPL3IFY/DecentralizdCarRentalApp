#!/bin/bash

echo "=========================================="
echo "CarRental Contract Deployment Script"
echo "=========================================="
echo ""

# Check if Ganache is running
echo "Step 1: Checking if Ganache is running..."
if curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo "Ganache is running on port 8545"
else
    echo "Ganache is not running!"
    echo "  Please start Ganache first: ganache -p 8545"
    exit 1
fi

echo ""
echo "Step 2: Compiling contracts..."
truffle compile
if [ $? -ne 0 ]; then
    echo "Compilation failed!"
    exit 1
fi
echo "Compilation successful"

echo ""
echo "Step 3: Deploying contracts..."
truffle migrate
if [ $? -ne 0 ]; then
    echo "Deployment failed!"
    exit 1
fi
echo "Deployment successful"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Note the contract address from the output above"
echo "2. Use 'truffle console' to interact with the contract"
echo "3. Check DEPLOYMENT_GUIDE.md for more details"
