const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    bidderEmail: {
      type: String,
      ref: "UserInfo.email",
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "tripInfo",
      unique: false,
    },
    bid: {
      type: Number,
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now(),
    },
    status: {
      type: String,
      enum: ["accepted", "rejected", "pending", "cancelled"],
      default: "pending",
    },
    recvName: {
      type: String,
      required: false,  // Set to false initially; can be true if required
    },
    recvNumber: {
      type: String,
      required: false,
    },
    recvCnic: {
      type: String,
      required: false,
    },
  },
  {
    collection: "bids",
  }
);

mongoose.model("bids", bidSchema);
