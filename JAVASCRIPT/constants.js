// constants.js
const CURRENCY = {
    code: "NGN",
    symbol: "₦",
    name: "Nigerian Naira",
    decimalPlaces: 2,
    thousandSeparator: ",",
    decimalSeparator: "."
};

const LIMITS = {
    dailyTransfer: 1000000,      // ₦1,000,000
    weeklyTransfer: 5000000,     // ₦5,000,000
    monthlyTransfer: 20000000,   // ₦20,000,000
    singleTransaction: 1000000,   // ₦1,000,000
    cardPrice: 3000,             // ₦15,000
    minExternalTransfer: 10000,   // ₦10,000
    maxExternalTransfer: 15000000 // ₦15,000,000
};

function formatMoney(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}