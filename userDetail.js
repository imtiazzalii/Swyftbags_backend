const mongoose = require("mongoose")

const userDetailSchema = new mongoose.Schema({
    name : String,
    email : {type :String, unique:true},
    password : String,
    confirmPassword: String,
    cnic : String,
    address: String,
    phoneNumber : String,
    profilePic : String,
    frontCNIC : String,
    backCNIC : String,

},
{
    collection:"UserInfo"
});

mongoose.model("UserInfo",userDetailSchema);