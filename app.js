const express = require("express");
const http = require("http"); // Import http module to create http server
const { Server } = require("socket.io"); // Import Server class from socket.io
require("dotenv").config();
const app = express();
const server = http.createServer(app); // Wrap the express app with http server
const io = new Server(server); // Create a new Socket.IO server and attach it to the http server
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const uploadImage = require("./components/UploadImage");
app.use(
  cors()
);
//app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb" }));
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require("jsonwebtoken");
var bodyParser = require("body-parser");
const UploadImage = require("./components/UploadImage");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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
require("./models/userDetail");
require("./models/tripDetails");
require("./models/bids");
require("./models/Notifications");
require("./models/messages");
require("./models/wallet");
require("./models/adminDetail");
const User = mongoose.model("UserInfo");
const Trip = mongoose.model("tripInfo");
const Bid = mongoose.model("bids");
const Notification = mongoose.model("Notification");
const Message = mongoose.model("messages");
const Admin = mongoose.model("AdminInfo");
const Wallet = mongoose.model("wallet");

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.on("joinRoom", ({ userId }) => {
    socket.join(userId);
    console.log(`User with ID: ${userId} joined room`);
  });

  socket.on("sendMessage", async ({ token, recepientId, messageText }) => {
    if (!token) {
      return console.error("Token not provided");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const sender = await User.findOne({ email: decoded.email }).select("_id");
    const message = new Message({
      senderId: sender,
      recepientId: recepientId,
      messageType: "text",
      message: messageText,
      imageUrl: null,
      timeStamp: new Date(),
    });

    const savedMessage = await message.save();
    console.log("Broadcasting message", savedMessage);
    io.to(sender._id.toString()).emit("receiveMessage", savedMessage); // Ensure sender receives it too
    io.to(recepientId.toString()).emit("receiveMessage", savedMessage);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.get("/", (req, res) => {
  res.send({ status: "Started backend" });
});

app.post("/Signup", async (req, res) => {
  const {
    name,
    email,
    password,
    cnic,
    address,
    phoneNumber,
    profilePic,
    frontCNIC,
    backCNIC,
    pushToken,
  } = req.body;

  const oldUser = await User.findOne({ email });
  if (oldUser) {
    return res.status(409).json({ message: "User already exists!" });
  }

  const encryptedPassword = await bcrypt.hash(password, 10);
  try {
    const [ppUrl, fcUrl, bcUrl] = await Promise.all([
      uploadImage(profilePic),
      uploadImage(frontCNIC),
      uploadImage(backCNIC),
    ]);

    const newUser = await User.create({
      name,
      email,
      password: encryptedPassword,
      cnic,
      address,
      phoneNumber,
      profilePic: ppUrl,
      frontCNIC: fcUrl,
      backCNIC: bcUrl,
      pushToken,
      status: "pending", // Ensure the user status is set to pending by default
    });

    res.status(201).json({ status: "ok", data: "User created successfully." });
  } catch (error) {
    res.status(500).json({ status: "error", data: error.message });
  }
});

app.post("/Login", async (req, res) => {
  const { Email, Password, pushToken } = req.body;

  try {
    const user = await User.findOne({ email: Email });
    console.log(user);
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", error: "User does not exist" });
    }

    if (user.status === "pending") {
      return res
        .status(401)
        .json({ status: "error", error: "Account not approved" });
    }

    const isPasswordValid = await bcrypt.compare(Password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ status: "error", error: "Invalid password" });
    }

    // Update the push token every time user logs in
    user.pushToken = pushToken;
    await user.save();

    const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET);
    res
      .status(200)
      .json({ status: "ok", data: token, userId: user._id.toString() });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

// app.get("/getBidderIdByEmail/:bidderEmail", async (req, res) => {
//   const { bidderEmail } = req.params;

//   try {
//     console.log("BIDDER KI ID: ",bidderEmail)
//     // Fetch bidderId based on bidderEmail
//     const user = await User.findOne({ email: bidderEmail });

//     if (user) {
//       res.status(200).json({ bidderId: user._id });
//     } else {
//       res.status(404).json({ message: "User not found" });
//     }
//   } catch (error) {
//     console.error("Error fetching bidderId:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// app.js (Node.js backend)

app.post("/initiate-payment", async (req, res) => {
  const { amount } = req.body;
  try {
    console.log("Creating payment intent with amount:", amount); // Log the amount to verify it's correct
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd", // Ensure 'pkr' is a supported currency in Stripe
      automatic_payment_methods: { enabled: true },
    });
    console.log("Payment Intent created:", paymentIntent.id); // Log the Payment Intent ID
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error); // Log the full error
    res.status(500).json({ error: error.message });
  }
});

app.get("/admin/pending-users", async (req, res) => {
  try {
    const fieldExclusions = "-password -pushToken -rating -friends"; // Specify fields to exclude
    const pendingUsers = await User.find({ status: "pending" }).select(
      fieldExclusions
    ); // Use select to exclude fields
    res.status(200).json({ status: "ok", data: pendingUsers });
  } catch (error) {
    console.error("Error fetching pending users:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.post("/admin/update-status", async (req, res) => {
  const { userId, status } = req.body;

  // Ensure the status is either 'approved' or 'rejected'
  if (!["approved", "rejected"].includes(status)) {
    return res
      .status(400)
      .json({ status: "error", error: "Invalid status provided" });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status: status },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ status: "error", error: "User not found" });
    }
    res.status(200).json({ status: "ok", data: updatedUser });
  } catch (error) {
    console.error("Failed to update user status", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.get("/inspector/trips", async (req, res) => {
  const { status, start } = req.query;

  try {
    let matchQuery = {
      status: "accepted", // Default to accepted if no specific status is provided
      ...(status && { status }),
      ...(start && { start }),
    };

    const tripsWithBids = await Trip.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "bids",
          let: { trip_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$tripId", "$$trip_id"] },
                    { $eq: ["$status", "accepted"] },
                  ],
                },
              },
            },
          ],
          as: "successfulBid",
        },
      },
      { $match: { "successfulBid.0": { $exists: true } } }, // Ensure there is at least one successful bid
      {
        $addFields: {
          bidderEmail: { $arrayElemAt: ["$successfulBid.bidderEmail", 0] },
        },
      },
      { $project: { successfulBid: 0 } }, // Optionally remove the successfulBid array from output
    ]);

    res.status(200).json(tripsWithBids);
  } catch (error) {
    console.error("Error fetching trips:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/inspector/tripsdest", async (req, res) => {
  const { status, destination } = req.query;

  try {
    let matchQuery = {
      status: "accepted", // Default to accepted if no specific status is provided
      ...(status && { status }),
      ...(destination && { destination }),
    };

    const tripsWithBids = await Trip.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "bids",
          let: { trip_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$tripId", "$$trip_id"] },
                    { $eq: ["$status", "accepted"] },
                  ],
                },
              },
            },
          ],
          as: "successfulBid",
        },
      },
      { $match: { "successfulBid.0": { $exists: true } } }, // Ensure there is at least one successful bid
      {
        $addFields: {
          bidderEmail: { $arrayElemAt: ["$successfulBid.bidderEmail", 0] },
        },
      },
      { $project: { successfulBid: 0 } }, // Optionally remove the successfulBid array from output
    ]);

    res.status(200).json(tripsWithBids);
  } catch (error) {
    console.error("Error fetching trips:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/inspector/trips/:tripId", async (req, res) => {
  const { tripId } = req.params;
  const { status } = req.body;

  try {
    // Update the status of the trip with the provided tripId
    const updatedTrip = await Trip.findByIdAndUpdate(
      tripId,
      { status },
      { new: true }
    );

    res.status(200).json(updatedTrip);
  } catch (error) {
    console.error("Error updating trip status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/logout", async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId);
    if (user) {
      user.pushToken = ""; // Clear the push token
      await user.save();
      res
        .status(200)
        .json({ status: "ok", message: "Logged out successfully" });
    } else {
      res.status(404).json({ status: "error", error: "User not found" });
    }
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.post("/adminLogin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email: email });
    if (!admin) {
      return res
        .status(404)
        .json({ status: "error", error: "Admin does not exist" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ status: "error", error: "Invalid password" });
    }

    const token = jwt.sign({ _id: admin._id, email: admin.email }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true, secure: true });
    res
      .status(200)
      .json({ status: "ok", data: token, adminCity: admin.address });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.get("/userData/:userId", (req, res) => {
  //const { token } = req.body;
  const token = req.params.userId;

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

app.get("/walletData/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId); // Directly find by userId
    if (!user) {
      return res.status(404).send({ status: "error", error: "User not found" });
    }
    return res.send({ status: "ok", data: user });
  } catch (error) {
    console.error("Error retrieving user data:", error);
    return res.status(500).send({ error: "Internal server error" });
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
    capacity,
    description,
    email,
    tmode,
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
      capacity: capacity,
      description: description,
      email: email,
      tmode: tmode,
      status: "pending",
    });

    res.send({ status: "ok", data: "Trip created" });
  } catch (error) {
    console.error("Error creating trip:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.post("/bid", async (req, res) => {
  const { id, bid, capacity, token, recvName, recvNumber, recvCnic} = req.body;

  try {
    const bidder = jwt.verify(token, JWT_SECRET);
    const bidderEmail = bidder.email;

    console.log("Bidder email:", bidder.email);  // Log the extracted email

    await Bid.create({
      bidderEmail: bidderEmail,
      tripId: id,
      bid: bid,
      capacity: capacity,
      recvName: recvName,
      recvNumber:recvNumber,
      recvCnic:recvCnic,
    });

    res.send({ status: "ok", data: "bid submitted" });
  } catch (error) {
    console.error("Error submitting bid:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.get("/getBidById/:bidId", async (req, res) => {
  const { bidId } = req.params;

  try {
    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({ status: "error", error: "Bid not found" });
    }
    res.status(200).json({ status: "ok", data: bid });
  } catch (error) {
    console.error("Error fetching bid:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});


app.get("/tripData/:userId", async (req, res) => {
  const token = req.params.userId;

  try {
    const trip = jwt.verify(token, JWT_SECRET);
    const tripemail = trip.email;

    Trip.find({ email: tripemail, status: "pending" }).then((data) => {
      return res.send({ status: "ok", data: data });
    });
  } catch (error) {
    return res.send({ error: error });
  }
});

app.get('/myOrders/trips/:tripId', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).send('Trip not found');
    }
    res.send(trip);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.delete('/myOrders/trips/:tripId', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).send('Trip not found');
    }
    if (trip.status !== 'accepted') {
      return res.status(403).send('This trip cannot be deleted');
    }
    await Trip.findByIdAndDelete(req.params.tripId);
    res.send({ message: 'Trip deleted successfully' });
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.post('/refund', async (req, res) => {
  const { senderEmail, tripId } = req.body;

  try {
    // Find the user by email to get the userId
    const user = await UserInfo.findOne({ email: senderEmail });
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Find the bid
    const bid = await Bid.findOne({ bidderEmail: senderEmail, tripId: tripId });
    if (!bid) {
      return res.status(404).send({ message: 'Bid not found' });
    }

    // Check if the bid is not already cancelled or rejected
    if (bid.status === 'cancelled' || bid.status === 'rejected') {
      return res.status(400).send({ message: 'Bid cannot be refunded as it is already cancelled or rejected' });
    }

    // Find the wallet by user ID
    const wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      return res.status(404).send({ message: 'Wallet not found' });
    }

    // Update the wallet balance
    wallet.balance += bid.bid;
    wallet.transactions.push({
      type: 'refund',
      amount: bid.bid,
      date: new Date()
    });
    await wallet.save();

    // Update the bid status
    bid.status = 'cancelled';
    await bid.save();

    // Success response
    res.send({ message: 'Refund processed successfully', balance: wallet.balance });
  } catch (error) {
    console.error('Refund processing error:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});

app.put("/updateTripDetails/:tripId", async (req, res) => {
  const { tripId } = req.params;
  const { recvName, recvNumber, recvCnic } = req.body;

  console.log(req.body)

  try {
    const updatedTrip = await Trip.findByIdAndUpdate(
      tripId,
      { recvName, recvNumber, recvCnic },
      { new: true }
    );
    if (!updatedTrip) {
      return res.status(404).json({ status: "error", error: "Trip not found" });
    }
    res.status(200).json({ status: "ok", data: updatedTrip });
  } catch (error) {
    console.error("Error updating trip details:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.delete('/trip/:tripId', async (req, res) => {
  const { tripId } = req.params;
  try {
    const deletedTrip = await Trip.findByIdAndDelete(tripId);
    if (!deletedTrip) {
      return res.status(404).json({ status: 'error', message: 'Trip not found' });
    }
    res.status(200).json({ status: 'ok', message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});



app.get("/showbids/:tripId", async (req, res) => {
  try {
    const tripId = req.params.tripId;

    // Fetch all bids with the matching tripId
    const allBids = await Bid.find({ tripId: tripId });

    // Create an array to store bids with associated user info
    const bidsWithUserInfo = [];

    // Iterate over each bid to fetch user info
    for (const bid of allBids) {
      const user = await User.findOne({ email: bid.bidderEmail });

      // If user info is found, add it to the bid data
      if (user) {
        bidsWithUserInfo.push({
          ...bid.toObject(), // Convert Mongoose document to plain object
          bidderName: user.name,
          bidderId: user._id,
          bidderProfilePic: user.profilePic,
          rating: user.rating,
        });
      }
    }

    // Send response with the bids and corresponding user info
    return res.send({ status: "ok", data: bidsWithUserInfo });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

app.put("/updateBidStatus/:bidId", async (req, res) => {
  try {
    const { bidId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["accepted", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Update the bid status
    const updatedBid = await Bid.findByIdAndUpdate(
      bidId,
      { status: status },
      { new: true }
    );

    if (!updatedBid) {
      return res.status(404).json({ message: "Bid not found" });
    }

    res.status(200).json({ message: "Bid status updated", data: updatedBid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/allTrips", async (req, res) => {
  const { departureCity, arrivalCity, weight, cost, transportMode } = req.query;

  try {
    let conditions = {};

    // Add string comparisons directly
    if (departureCity && departureCity !== "")
      conditions["start"] = departureCity;
    if (arrivalCity && arrivalCity !== "")
      conditions["destination"] = arrivalCity;
    // Assuming you want to match exact strings or simple pattern (not numeric comparison)
    if (weight && weight !== "") conditions["capacity"] >= weight;
    if (transportMode && transportMode !== "")
      conditions["tmode"] = transportMode;

    console.log("Query conditions:", conditions);

    const allTrips = await Trip.find(conditions);
    console.log("All trips:", allTrips);

    const tripDataWithUser = [];
    for (const trip of allTrips) {
      const user = await User.findOne({ email: trip.email });
      if (user) {
        tripDataWithUser.push({
          trip: trip,
          user: {
            userId: user._id,
            username: user.name,
            profilePic: user.profilePic,
            rating: user.rating,
          },
        });
      }
    }

    return res.send({ status: "ok", data: tripDataWithUser });
  } catch (error) {
    console.error("Error in /allTrips:", error);
    return res.status(500).send({ error: error.message });
  }
});

app.get("/myOrders/:userId", async (req, res) => {
  try {
    // Fetch the user's email using the userId
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const email = user.email;

    // Find bids with the user's email where the status is 'accepted'
    const bids = await Bid.find({
      bidderEmail: email,
      status: "accepted",
    }).populate({
      path: "tripId",
      match: { status: { $nin: ["pending"] } },
    });

    // Filter out any null populated trips
    const trips = bids.map((bid) => bid.tripId).filter((trip) => trip != null);

    const tripDataWithUser = [];
    for (const trip of trips) {
      const user1 = await User.findOne({ email: trip.email });
      if (user1) {
        tripDataWithUser.push({
          trip: trip,
          user: {
            userId: user1._id,
            username: user1.name,
            profilePic: user1.profilePic,
            rating: user1.rating,
          },
        });
      }
    }

    console.log("trips: ", tripDataWithUser);
    res.json({ success: true, data: tripDataWithUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/Trips/:userId", async (req, res) => {
  try {
    // Fetch the user's email using the userId
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const email1 = user.email;

    const trips = await Trip.find({
      email: email1,
      status: { $ne: "pending" },
    });
    
    const tripDataWithUser = [];
    for (const trip of trips) {
      const user1 = await User.findOne({ email: trip.email });
      if (user1) {
        tripDataWithUser.push({
          trip: trip,
          user: {
            userId: user1._id,
            email: user1.email,
            username: user1.name,
            profilePic: user1.profilePic,
            rating: user1.rating,
          },
        });
      }
    }

    console.log("trips: ", tripDataWithUser);
    res.json({ success: true, data: tripDataWithUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/updateTripStatus/:tripId", async (req, res) => {
  const { tripId } = req.params;
  const { status } = req.body;

  try {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status: status },
      { new: true }
    );
    if (!trip) {
      return res.status(404).send("Trip not found");
    }
    res.send({ data: trip, message: "Trip status updated successfully" });
  } catch (error) {
    res.status(500).send("Error updating trip status: " + error);
  }
});

// Get trip details by trip ID
app.get('/tripDetails/:id', async (req, res) => {
  try {
      const trip = await Trip.findById(req.params.id);
      if (!trip) {
          return res.status(404).json({ message: 'Trip not found' });
      }
      res.status(200).json(trip);
  } catch (error) {
      console.error("Database access error:", error);
      res.status(500).json({ message: 'Error retrieving trip details', error: error.message });
  }
});

// Endpoint to get sender's name by trip ID
app.get('/senderName/:tripId', async (req, res) => {
  try {
      const bid = await Bid.findOne({ tripId: req.params.tripId, status: 'accepted' }).exec();
      if (!bid) {
          return res.status(404).json({ message: 'No accepted bid found for this trip' });
      }

      const user = await User.findOne({ email: bid.bidderEmail }).exec();
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json({ name: user.name });
  } catch (error) {
      console.error("Error fetching sender's name:", error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//endpoint to access all the friends of the logged in user!
app.get("/accepted-friends/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email: decoded.email }).populate(
      "friends",
      "_id name email profilePic"
    );
    if (user) {
      return res.send({ status: "ok", data: user.friends });
    } else {
      res.status(500).json({ error: "DB Error" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const multer = require("multer");
const storage = multer.memoryStorage(); // Using memory storage for simplicity
const upload = multer({ storage: storage });

app.post("/messages", upload.none(), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const sender = await User.findOne({ email: decoded.email }).select("_id");
    if (!sender) {
      return res.status(404).json({ error: "Sender not found" });
    }

    const { recepientId, messageType, messageText } = req.body;
    const newMessage = new Message({
      senderId: sender._id,
      recepientId: recepientId,
      messageType: messageType,
      message: messageText,
      timeStamp: new Date(),
      imageUrl: null, // Assuming no image is handled for now
    });

    await newMessage.save();
    io.to(recepientId).emit("message", newMessage); // Emit message to the recipient in real-time
    res.status(200).json({ message: "Message sent Successfully" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

///endpoint to get the userDetails to design the chat Room header
app.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    //fetch the user data from the user ID
    const recepientId = await User.findById(userId);

    res.json(recepientId);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//endpoint to fetch the messages between 2 users in the chatroom
app.get("/messages/:senderToken/:recepientId", async (req, res) => {
  try {
    const { senderToken, recepientId } = req.params;
    const senderEmail = jwt.verify(senderToken, JWT_SECRET);
    const sender = await User.findOne({ email: senderEmail.email }).select(
      "_id"
    );
    const senderId = sender._id;
    const messages = await Message.find({
      $or: [
        { senderId: senderId, recepientId: recepientId },
        { senderId: recepientId, recepientId: senderId },
      ],
    }).populate("senderId", ["_id", "name"]);
    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Change Password endpoint
// Inside the "/ChangePassword" endpoint
app.post("/ChangePassword", async (req, res) => {
  const { email, oldpassword, password } = req.body; // Include email in the request body

  try {
    // Find the user by email
    const user = await User.findOne({ email: email });

    // If user doesn't exist, return an error
    if (!user) {
      return res.status(400).json({ status: "error", error: "User not found" });
    }

    console.log(oldpassword);
    // Verify the current password
    const isPasswordValid = await bcrypt.compare(oldpassword, user.password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ status: "error", error: "Invalid current password" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(password, 10);

    // Update the user's password
    await User.updateOne({ email: email }, { password: hashedNewPassword });

    // Send success response
    res
      .status(200)
      .json({ status: "ok", message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.get("/notifications", async (req, res) => {
  const token = req.headers.authorization;
  console.log(token);

  try {
    if (!token) {
      return res
        .status(401)
        .json({ status: "error", error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(decoded._id);
    const userId = decoded._id; // Assuming the token contains the user's MongoDB ObjectID

    const notifications = await Notification.find({ userId: userId });
    res.status(200).json({ status: "ok", data: notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.patch("/notification/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { viewed: true },
      { new: true }
    );

    res.status(200).json({ status: "ok", data: updatedNotification });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.post("/createNotification", async (req, res) => {
  const { userId, message, type } = req.body;

  try {
    const newNotification = new Notification({
      userId,
      message,
      type,
    });
    console.log(newNotification);

    await newNotification.save();

    const user = await User.findById(userId);
    if (user && user.pushToken) {
      let title = "New Notification"; // Default title
      switch (type) {
        case "bid":
          title = "New Bid";
          break;
        case "chat":
          title = "New Message";
          break;
        case "Accept":
          title = "Bid Accepted";
          break;
        case "Reject":
          title = "Bid Rejected";
          break;
      }

      const response = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        {
          to: user.pushToken,
          title,
          body: message,
        },
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Push notification sent:", response.data);
    }

    res
      .status(201)
      .json({
        status: "ok",
        data: "Notification created and push sent successfully.",
      });
  } catch (error) {
    console.error("Error creating notification or sending push:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.get("/notifications", async (req, res) => {
  const token = req.headers.authorization;
  console.log(token);

  try {
    if (!token) {
      return res
        .status(401)
        .json({ status: "error", error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(decoded._id);
    const userId = decoded._id; // Assuming the token contains the user's MongoDB ObjectID

    const notifications = await Notification.find({ userId: userId });
    res.status(200).json({ status: "ok", data: notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.patch("/notification/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { viewed: true },
      { new: true }
    );

    res.status(200).json({ status: "ok", data: updatedNotification });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.post("/wallet/create", async (req, res) => {
  const { userId } = req.body;

  try {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      // Create a new wallet with zero balance and no transactions
      wallet = new Wallet({
        userId: userId,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
      res.status(201).json({ message: "Wallet created successfully", wallet });
    } else {
      res.status(200).json({ message: "Wallet already exists", wallet });
    }
  } catch (error) {
    console.error("Error in creating wallet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/wallet/transaction", async (req, res) => {
  const { userId, amount, type } = req.body;

  try {
    let wallet = await Wallet.findOne({ userId });
    if (wallet) {
      wallet.balance += amount;
      wallet.transactions.push({
        type: type,
        amount: amount,
        date: new Date(),
      });
      await wallet.save();
      res
        .status(200)
        .json({ message: "Transaction processed successfully", wallet });
    } else {
      res.status(404).json({ message: "Wallet not found" });
    }
  } catch (error) {
    console.error("Error processing transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/wallet/details/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const wallet = await Wallet.findOne({ userId });
    if (wallet) {
      res
        .status(200)
        .json({ message: "Wallet details fetched successfully", data: wallet });
    } else {
      res.status(404).json({ message: "Wallet not found" });
    }
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/chargeWallet", async (req, res) => {
  try {
    const { bidderId, bidAmount } = req.body;

    // Calculate the total amount to charge from the bidder's wallet including the fee
    const totalAmount = bidAmount + 0.05 * bidAmount;

    // Check if the bidder has sufficient funds in their wallet
    const bidderWallet = await Wallet.findOne({ userId: bidderId });
    if (!bidderWallet || bidderWallet.balance < totalAmount) {
      return res.status(400).json({ message: "Insufficient funds in wallet" });
    }

    // Deduct the total amount from the bidder's wallet balance
    bidderWallet.balance -= totalAmount;
    await bidderWallet.save();

    return res
      .status(200)
      .json({ message: "Bidder wallet charged successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/wallet/deposit", async (req, res) => {
  const { email, amount } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the user's wallet by userId
    let wallet = await Wallet.findOne({ userId: user._id });
    // Update the wallet balance and add a transaction record
    console.log("amount: ",amount)
    wallet.balance += amount;
    wallet.transactions.push({
      type: "deposit",
      amount: amount,
      date: new Date(),
    });

    await wallet.save();

    res.status(200).json({ message: "Amount deposited successfully", wallet });
  } catch (error) {
    console.error("Error depositing amount:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add this endpoint in your app.js

app.get("/bids/accepted", async (req, res) => {
  const { tripId, recvName } = req.query;

  try {
    // Find the bid with the specified tripId, recvName, and status "accepted"
    const bid = await Bid.findOne({ tripId: tripId, recvName: recvName, status: "accepted" });
    if (!bid) {
      return res.status(404).json({ error: "Accepted bid not found for this trip with the specified receiver name" });
    }

    res.status(200).json({ bid: bid.bid });
  } catch (error) {
    console.error("Error fetching accepted bid:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.post("/makeFriend", async (req, res) => {
  const { bidderId, userId } = req.body;

  try {
    // Check if both users exist
    const usersExist = await User.countDocuments({
      _id: { $in: [bidderId, userId] },
    });

    if (usersExist !== 2) {
      return res.status(404).json({ message: "One or both users not found" });
    }

    // Update both users' friends list
    await User.updateOne({ _id: userId }, { $addToSet: { friends: bidderId } });

    await User.updateOne({ _id: bidderId }, { $addToSet: { friends: userId } });

    return res.status(200).json({ message: "Friendship created successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


app.post("/friends/remove", async (req, res) => {
  const { senderEmail, travellerEmail } = req.body;

  try {
    // Find sender and traveller by their emails
    const sender = await User.findOne({ email: senderEmail });
    const traveller = await User.findOne({ email: travellerEmail });

    if (!sender || !traveller) {
      return res.status(404).json({ error: "One or both users not found" });
    }

    // Remove each other from friends array
    await User.updateOne(
      { _id: sender._id },
      { $pull: { friends: traveller._id } }
    );

    await User.updateOne(
      { _id: traveller._id },
      { $pull: { friends: sender._id } }
    );

    res.status(200).json({ message: "Users removed from each other's friends list successfully" });
  } catch (error) {
    console.error("Error removing users from friends list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host:"smtp.gmail.com",
  port:587,
  secure:false,
  auth: {
    user: 'swyftbags03@gmail.com',
    pass: process.env.EMAIL_PASS,
  }
});


app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email });
  if (!user) {
    return res.status(404).json({ status: "error", error: "User not found" });
  }

  // Generate a temporary password
  const temporaryPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  // Update user's password in the database
  user.password = hashedPassword;
  await user.save();

  // Send email with the temporary password
  const mailOptions = {
    from: 'swyftbags03@gmail.com',
    to: email,
    subject: 'Temporary Password',
    text: `Your temporary password is: ${temporaryPassword}\nPlease log in with this password and change it immediately.`
  };

  transporter.sendMail(mailOptions, function(err, info) {
    if (err) {
      console.error('Email sending error:', err);
      return res.status(500).json({ status: "error", error: "Failed to send email" });
    } else {
      console.log('Email sent: ' + info.response);
      res.status(200).json({ status: "ok", message: "Temporary password sent to your email." });
    }
  });
});

// Email Notification API
app.post('/sendEmailNotification', async (req, res) => {
  const { email, subject, message } = req.body;

  try {
    const mailOptions = {
      from: 'swyftbags03@gmail.com',
      to: email,
      subject: subject,
      text: message
    };

    transporter.sendMail(mailOptions, function(err, info) {
      if (err) {
        console.error('Email sending error:', err);
        return res.status(500).json({ status: "error", error: "Failed to send email" });
      } else {
        console.log('Email sent: ' + info.response);
        res.status(200).json({ status: "ok", message: "Email sent successfully." });
      }
    });
  } catch (error) {
    console.error('Error sending email notification:', error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});


server.listen(process.env.PORT, () => {
  console.log("Node js server started");
});
