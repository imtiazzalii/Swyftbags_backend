const express = require("express");
const http = require("http"); // Import http module to create http server
const { Server } = require("socket.io"); // Import Server class from socket.io
require("dotenv").config();
const app = express();
const server = http.createServer(app); // Wrap the express app with http server
const io = new Server(server); // Create a new Socket.IO server and attach it to the http server
const mongoose = require("mongoose");
const cors = require("cors");
const uploadImage = require("./components/UploadImage");
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb" }));
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
var bodyParser = require("body-parser");
const UploadImage = require("./components/UploadImage");

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
require("./models/userDetail");
require("./models/tripDetails");
require("./models/bids");
require("./models/messages");
const User = mongoose.model("UserInfo");
const Trip = mongoose.model("tripInfo");
const Bid = mongoose.model("bids");
const Message = mongoose.model("messages");

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.on("joinRoom",({ userId }) => {
    
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
      uploadImage(backCNIC),
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

    res.status(200).json({ status: "ok", data: token, userId: user._id.toString() });
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
      buyout: buyout,
      capacity: capacity,
      description: description,
      email: email,
      tmode: tmode,
    });

    res.send({ status: "ok", data: "Trip created" });
  } catch (error) {
    console.error("Error creating trip:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.post("/bid", async (req, res) => {
  const { id, bid, capacity, token } = req.body;

  try {
    const bidder = jwt.verify(token, JWT_SECRET);
    const bidderEmail = bidder.email;

    await Bid.create({
      bidderEmail: bidderEmail,
      tripId: id,
      bid: bid,
      capacity: capacity,
    });

    res.send({ status: "ok", data: "bid submitted" });
  } catch (error) {
    console.error("Error submitting bid:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

app.get("/tripData/:userId", async (req, res) => {
  const token = req.params.userId;

  try {
    const trip = jwt.verify(token, JWT_SECRET);
    const tripemail = trip.email;

    Trip.find({ email: tripemail }).then((data) => {
      return res.send({ status: "ok", data: data });
    });
  } catch (error) {
    return res.send({ error: error });
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
          bidderProfilePic: user.profilePic,
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
  try {
    // Fetch all trips
    const allTrips = await Trip.find();

    // Create an array to store trip data with associated user data
    const tripDataWithUser = [];

    // Iterate over each trip
    for (const trip of allTrips) {
      // Find user details based on the email associated with the trip
      const user = await User.findOne({ email: trip.email });

      // If user details are found, add trip and user data to the tripDataWithUser array
      if (user) {
        tripDataWithUser.push({
          trip: trip,
          user: {
            username: user.name,
            profilePic: user.profilePic,
            rating: user.rating,
          },
        });
      }
    }

    // Send response with trip data and corresponding user data
    return res.send({ status: "ok", data: tripDataWithUser });
  } catch (error) {
    return res.status(500).send({ error: error.message });
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

//endpoint to post Messages and store it in the backend
// app.post("/messages", upload.none(), async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];
//     if (!token) {
//       return res.status(401).json({ error: "No token provided" });
//     }

//     const decoded = jwt.verify(token, JWT_SECRET);
//     const sender = await User.findOne({ email: decoded.email }).select("_id");
//     if (!sender) {
//       return res.status(404).json({ error: "Sender not found" });
//     }

//     const { recepientId, messageType, messageText } = req.body;
//     const newMessage = new Message({
//       senderId: sender._id,
//       recepientId: recepientId,
//       messageType: messageType,
//       message: messageText,
//       timeStamp: new Date(),
//       imageUrl: null, // Assuming no image is handled for now
//     });

//     await newMessage.save();
//     res.status(200).json({ message: "Message sent Successfully" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error: "Internal Server Error", details: error.message });
//   }
// });

// Modify existing message route to emit messages via Socket.IO
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

server.listen(process.env.PORT, () => {
  console.log("Node js server started");
});
