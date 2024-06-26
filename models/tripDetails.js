const mongoose = require("mongoose")

const tripDetailSchema = new mongoose.Schema({
    start : String,
    destination : String,
    startdate: String,
    starttime: String,
    enddate: String,
    endtime: String,
    startbid:String,
    capacity: String,
    description: String,
    email: String,
    tmode: String,
    status: {
      type: String,
      enum: [ "pending", "accepted", "reached inspector 1", "dispatched", "reached inspector 2", "completed"],
      default: "pending",
    },
    recvName: String,
    recvNumber: String,
    recvCnic: String,

},
{
    collection:"tripInfo"
});

mongoose.model("tripInfo",tripDetailSchema);