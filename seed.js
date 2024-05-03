const express = require("express");
require("dotenv").config();
const app = express();
const mongoose = require("mongoose");
const mongoUrl = process.env.MONGODB_URL;
const bcrypt = require("bcrypt");
require("./models/adminDetail");
require("./models/tripDetails");
const Admin = mongoose.model("AdminInfo");
const Trip = mongoose.model("tripInfo");

mongoose.connect(mongoUrl, { connectTimeoutMS: 30000 })
  .then(() => {
    console.log("Database connected");
    return AddNewTrip(); // Ensuring that the function executes after connection
  })
  .then(() => console.log("Trip added"))
  .catch((e) => {
    console.log("Error connecting to database:", e);
  });

async function AdminAccount() {
  // const adminCount = await Admin.countDocuments();
  // if (adminCount === 0) {
    const hashPassword = await bcrypt.hash("islamabadinspector", 10);
    const newAdmin = new Admin({
      name: "Islamabad Inspector",
      email: "islamabad_inspector@gmail.com",
      password: hashPassword,
      cnic: "4250151606067",
      address: "Lahore",
      phoneNumber: "03032710575",
    });
    await newAdmin.save();
  // } 
  // else {
  //   console.log("account already existed");
  // }
}

async function AddNewTrip() {
    const newTrip = new Trip({
      start: "Lahore",
      destination: "Karachi",
      startdate: "2024/05/03",
      starttime: "00:00",
      enddate: "2024/05/05",
      endtime: "02:00",
      startbid: "100",
      buyout: "500",
      capacity: "2",
      description: "no edibles",
      email: "eshal@gmail.com",
      tmode: "By Train",
      status: "pending",
    });
    await newTrip.save();
}