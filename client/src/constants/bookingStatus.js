/**
 * Booking Status Enum - matches CarRental.sol
 */
export const BookingStatus = {
    None: 0,
    Requested: 1,
    Approved: 2,
    Active: 3,
    Completed: 4,
    Rejected: 5,
    Cancelled: 6,
    Disputed: 7,
};

/**
 * Get human-readable status name
 */
export const getStatusName = (status) => {
    const statusNum = Number(status);
    return (
        Object.keys(BookingStatus).find(
            (key) => BookingStatus[key] === statusNum
        ) || "Unknown"
    );
};

/**
 * Get status color for UI
 */
export const getStatusColor = (status) => {
    const statusNum = Number(status);
    switch (statusNum) {
        case BookingStatus.Requested:
            return "bg-yellow-100 text-yellow-800";
        case BookingStatus.Approved:
            return "bg-blue-100 text-blue-800";
        case BookingStatus.Active:
            return "bg-green-100 text-green-800";
        case BookingStatus.Completed:
            return "bg-gray-100 text-gray-800";
        case BookingStatus.Rejected:
            return "bg-red-100 text-red-800";
        case BookingStatus.Cancelled:
            return "bg-gray-100 text-gray-800";
        case BookingStatus.Disputed:
            return "bg-purple-100 text-purple-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
};

/**
 * Check if booking can be cancelled
 */
export const canCancel = (status) => {
    const statusNum = Number(status);
    return (
        statusNum === BookingStatus.Requested ||
        statusNum === BookingStatus.Approved
    );
};

/**
 * Check if booking is active
 */
export const isActive = (status) => {
    const statusNum = Number(status);
    return statusNum === BookingStatus.Active;
};

/**
 * Check if a dispute can be opened for this booking
 */
export const canOpenDispute = (status) => {
    const statusNum = Number(status);
    return (
        statusNum === BookingStatus.Approved ||
        statusNum === BookingStatus.Active
    );
};
