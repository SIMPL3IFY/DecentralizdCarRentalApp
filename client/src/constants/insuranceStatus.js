export const InsuranceStatus = {
    Pending: 0,
    Approved: 1,
    Rejected: 2,
};

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
