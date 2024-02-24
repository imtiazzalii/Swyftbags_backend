const mongoose = require("mongoose")

const tripDetailSchema = new mongoose.Schema({
    start : String,
    destination : String,
    startdate: String,
    starttime: String,
    enddate: String,
    endtime: String,
    startbid:String,
    buyout: String,
    capacity: String,
    description: String,
    email: String,

},
{
    collection:"tripInfo"
});

mongoose.model("tripInfo",tripDetailSchema);