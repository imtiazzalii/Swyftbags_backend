const express = require("express");
require("dotenv").config();
const app = express();
const mongoose = require("mongoose");
const mongoUrl = process.env.MONGODB_URL;
const bcrypt = require("bcrypt");
require("./models/adminDetail");
const Admin = mongoose.model("AdminInfo");

mongoose
  .connect(mongoUrl)
  .then(() => {
    console.log("Database connected");
  })
  .catch((e) => {
    console.log(e);
  });

async function AdminAccount() {
  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    const hashPassword = await bcrypt.hash("adminpassword", 10);
    const newAdmin = new Admin({
      name: "John Doe",
      email: "admin@gmail.com",
      password: hashPassword,
      cnic: "4250151606067",
      address: "Karachi",
      phoneNumber: "03032710575",
    });
    await newAdmin.save();
    console.log("account created");
  } else {
    console.log("account already existed");
  }
}
AdminAccount();