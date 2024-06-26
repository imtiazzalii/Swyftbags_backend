const mongoose = require("mongoose");

const userDetailSchema = new mongoose.Schema({
    name: String,
    email: {type :String, unique:true},
    password: String,
    cnic: String,
    address: String,
    phoneNumber: String,
    profilePic: String,
    frontCNIC: String,
    backCNIC: String,
    pushToken: String,  // Add this field to store the push notification token
    rating: 
    {
        type: Number,
        min: 0.0,
        max: 5.0,
        default: 0.0
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserInfo",
      },
    ],
    status: {
      type: String,
      enum: [ "pending", "approved", "rejected"],
      default: "pending",
    },
},
{
    collection:"UserInfo"
});

mongoose.model("UserInfo", userDetailSchema);
