const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userInfo",
    },
    receipentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userInfo",
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
  },
  {
    collection: "bids",
  }
);

mongoose.model("bids", bidSchema);