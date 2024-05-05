const mongoose = require("mongoose");
const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserInfo',
        required: true
    },
    balance: { type: Number, default: 0 },
    transactions: [{
        type: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        date: { type: Date, default: Date.now }
    }]
}, { collection: "wallet" });

mongoose.model("wallet", walletSchema);
