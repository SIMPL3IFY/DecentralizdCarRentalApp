/**
 * Insurance Status enum values matching the smart contract
 * enum InsuranceStatus {
 *     Pending,    // 0 - never verified
 *     Approved,   // 1 - verified and valid
 *     Rejected    // 2 - explicitly rejected
 * }
 */
export const InsuranceStatus = {
    Pending: 0,
    Approved: 1,
    Rejected: 2,
};

/**
 * Helper function to get status name
 */
export const getInsuranceStatusName = (status) => {
    switch (Number(status)) {
        case InsuranceStatus.Pending:
            return "Pending";
        case InsuranceStatus.Approved:
            return "Approved";
        case InsuranceStatus.Rejected:
            return "Rejected";
        default:
            return "Unknown";
    }
};
