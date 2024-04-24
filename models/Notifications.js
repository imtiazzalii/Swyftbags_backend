const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "UserInfo" 
    },
    message: String,
    type: {
        type: String,
        enum: ['bid', 'chat', 'other'], // You can add more types as needed
        default: 'other'
    },
    viewed: { 
        type: Boolean, 
        default: false 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
}, {
    collection: "Notification"
});

mongoose.model("Notification", notificationSchema);

