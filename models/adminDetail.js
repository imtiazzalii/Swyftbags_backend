const mongoose = require("mongoose");

const adminDetailSchema = new mongoose.Schema({
    name: String,
    email: {type :String, unique:true},
    password: String,
    cnic: String,
    address: String,
    phoneNumber: String,
},
{
    collection:"AdminInfo"
});

mongoose.model("AdminInfo", adminDetailSchema);
