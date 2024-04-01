const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserInfo",
    },
    recepientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserInfo",
    },
    messageType: {
      type: String,
      enum: ["text", "image"],
    },
    message: String,
    imageUrl: String,
    timeStamp: {
      type: Date,
      default: Date.now(),
    },
  },
  {
    collection: "messages",
  }
);

mongoose.model("messages", messageSchema);
