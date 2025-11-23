/**
 * Application Configuration
 */
export const RPC_URL = "http://127.0.0.1:8545";
export const CONTRACT_ABI_PATH = "/CarRental.json";
// Contract address - can be set here or will be loaded from localStorage
export const CONTRACT_ADDRESS = "0xf0aFa41E48c9151F78e7C983223C5803Dc035c73"; 
export const GAS_LIMITS = {
    register: 100000,
    createListing: 500000,
    requestBooking: 500000,
    approveBooking: 200000,
    rejectBooking: 200000,
    cancelBooking: 200000,
    confirmPickup: 200000,
    confirmReturn: 300000,
    openDispute: 200000,
    resolveDispute: 300000,
    rateOwner: 200000,
    rateRenter: 200000,
    withdraw: 200000,
    verifyInsurance: 200000,
    editListing: 200000,
    setListingActive: 200000,
};
