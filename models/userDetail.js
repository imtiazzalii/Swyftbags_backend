const mongoose = require("mongoose")

const userDetailSchema = new mongoose.Schema({
    name : String,
    email : {type :String, unique:true},
    password : String,
    cnic : String,
    address: String,
    phoneNumber : String,
    profilePic : String,
    frontCNIC : String,
    backCNIC : String,
    rating: [{
        type: Number,
        min: 0.0,
        max: 5.0,
        default: 0.0
    }]
},
{
    collection:"UserInfo"
});

mongoose.model("UserInfo",userDetailSchema);