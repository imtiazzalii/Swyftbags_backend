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
  },
  {
    collection: "bids",
  }
);

mongoose.model("bids", bidSchema);
