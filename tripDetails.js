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
    description: String,

},
{
    collection:"tripInfo"
});

mongoose.model("tripInfo",tripDetailSchema);