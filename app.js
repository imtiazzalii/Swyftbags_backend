const express = require("express");
require('dotenv').config();
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const uploadImage = require("./UploadImage")
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb" }));
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
var bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(function (req, res) {
//     res.setHeader('Content-Type', 'text/plain')
//     res.write('you posted:\n')
//     // res.end(JSON.stringify(req.body, null, 2))
//   })

const mongoUrl = process.env.MONGODB_URL;

const JWT_SECRET = process.env.JWT_SECRET;

mongoose
  .connect(mongoUrl)
  .then(() => {
    console.log("Database connected");
  })
  .catch((e) => {
    console.log(e);
  });
require("./userDetail");
require("./tripDetails");
const User = mongoose.model("UserInfo");
const Trip = mongoose.model("tripInfo");

app.get("/", (req, res) => {
  res.send({ status: "Started" });
});

app.post("/Signup", async (req, res) => {
  const {
    name,
    email,
    password,
    confirmPassword,
    cnic,
    address,
    phoneNumber,
    profilePic,
    frontCNIC,
    backCNIC,
  } = req.body;

  const oldUser = await User.findOne({ email: email });

  if (oldUser) {
    return res.send({ data: "user already exist!!" });
  }
  encyptedPassword = await bcrypt.hash(password, 10);

  try {
    
    const [ppUrl, fcUrl, bcUrl] = await Promise.all([
        uploadImage(profilePic),
        uploadImage(frontCNIC),
        uploadImage(backCNIC)
      ]);

    await User.create({
      name: name,
      email: email,
      password: encyptedPassword,
      //confirmPassword: confirmPassword,
      cnic: cnic,
      address: address,
      phoneNumber: phoneNumber,
      profilePic: ppUrl,
      frontCNIC: fcUrl,
      backCNIC: bcUrl,
    });
    res.send({ status: "ok", data: "User created" });
  } catch (error) {
    res.send({ status: "error", data: "error" });
  }
});

app.post("/Login", async (req, res) => {
  const { Email, Password } = req.body;

  try {
    const user = await User.findOne({ email: Email });

    if (!user) {
      return res
        .status(400)
        .json({ status: "error", error: "User does not exist" });
    }

    const isPasswordValid = await bcrypt.compare(Password, user.password);

    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ status: "error", error: "Invalid password" });
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET);

    res.status(200).json({ status: "ok", data: token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.post("/userData", async (req, res) => {
  const { token } = req.body;

  try {
    const user = jwt.verify(token, JWT_SECRET);
    const useremail = user.email;

    User.findOne({ email: useremail }).then((data) => {
      return res.send({ status: "ok", data: data });
    });
  } catch (error) {
    return res.send({ error: error });
  }
});

app.post("/NewTrip", async (req, res) => {
  const {
    start,
    destination,
    startdate,
    starttime,
    enddate,
    endtime,
    startbid,
    buyout,
    description,
  } = req.body;

  try {
    await Trip.create({
      start: start,
      destination: destination,
      startdate: startdate,
      starttime: starttime,
      enddate: enddate,
      endtime: endtime,
      startbid: startbid,
      buyout: buyout,
      description: description,
    });

    res.send({ status: "ok", data: "Trip created" });
  } catch (error) {
    console.error("Error creating trip:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

// Assuming you already have necessary imports and configurations

// Change Password endpoint
app.post("/ChangePassword", async (req, res) => {
  const { email, oldpassword, password } = req.body;



  try {
    // Find the user by email
    const user = await User.findOne({ email });

    // Check if the user exists
    if (!user) {
      return res.status(400).json({ status: "error", error: "User not found" });
    }

    // Verify the current password
    const isPasswordValid = await bcrypt.compare(oldpassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ status: "error", error: "Invalid current password" });
    }
    
    console.log(password)
    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(password, 10);

    // Update the user's password
    await User.updateOne({ email }, { password: hashedNewPassword });

    // Send success response
    res.status(200).json({ status: "ok", message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});


app.listen(process.env.PORT, () => {
  console.log("Node js server started");
});
