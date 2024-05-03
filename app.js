const express = require("express");
const http = require("http"); // Import http module to create http server
const { Server } = require("socket.io"); // Import Server class from socket.io
require("dotenv").config();
const app = express();
const server = http.createServer(app); // Wrap the express app with http server
const io = new Server(server); // Create a new Socket.IO server and attach it to the http server
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require('axios');
const uploadImage = require("./components/UploadImage");
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb" }));
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
var bodyParser = require("body-parser");
const UploadImage = require("./components/UploadImage");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
require("./models/Notifications");
require("./models/messages");
const User = mongoose.model("UserInfo");
const Trip = mongoose.model("tripInfo");
const Bid = mongoose.model("bids");
const Notification = mongoose.model("Notification");
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
  const { name, email, password, cnic, address, phoneNumber, profilePic, frontCNIC, backCNIC, pushToken } = req.body;

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
      pushToken
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
    console.log(user)
    if (!user) {
      return res.status(404).json({ status: "error", error: "User does not exist" });
    }

    const isPasswordValid = await bcrypt.compare(Password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ status: "error", error: "Invalid password" });
    }

    // Update the push token every time user logs in
    user.pushToken = pushToken;
    await user.save();

    const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET);
    res.status(200).json({ status: "ok", data: token, userId: user._id.toString() });
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

app.post('/initiate-payment', async (req, res) => {
  const { amount } = req.body;
  try {
      console.log("Creating payment intent with amount:", amount); // Log the amount to verify it's correct
      const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',  // Ensure 'pkr' is a supported currency in Stripe
          automatic_payment_methods: { enabled: true },
      });
      console.log("Payment Intent created:", paymentIntent.id);  // Log the Payment Intent ID
      res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
      console.error("Error creating payment intent:", error);  // Log the full error
      res.status(500).json({ error: error.message });
  }
});


app.post("/logout", async (req, res) => {
  const { userId } = req.body;
  try {
      const user = await User.findById(userId);
      if (user) {
          user.pushToken = ""; // Clear the push token
          await user.save();
          res.status(200).json({ status: "ok", message: "Logged out successfully" });
      } else {
          res.status(404).json({ status: "error", error: "User not found" });
      }
  } catch (error) {
      console.error("Logout Error:", error);
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
          bidderId: user._id,
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
  const { departureCity, arrivalCity, weight, cost, transportMode } = req.query;

  try {
    let conditions = {};

    // Add string comparisons directly
    if (departureCity && departureCity !== "") conditions['start'] = departureCity;
    if (arrivalCity && arrivalCity !== "") conditions['destination'] = arrivalCity;
    // Assuming you want to match exact strings or simple pattern (not numeric comparison)
    if (weight && weight !== "") conditions['capacity'] = weight;
    if (transportMode && transportMode !== "") conditions['tmode'] = transportMode;

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

app.get("/notifications", async (req, res) => {
  const token = req.headers.authorization;
  console.log(token)

  try {
    if (!token) {
      return res.status(401).json({ status: "error", error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(decoded._id)
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
      type
    });
    console.log(newNotification)

    await newNotification.save();

    const user = await User.findById(userId);
    if (user && user.pushToken) {
      let title = 'New Notification'; // Default title
      switch(type) {
        case 'bid':
          title = 'New Bid';
          break;
        case 'chat':
          title = 'New Message';
          break;
        case 'Accept':
          title = 'Bid Accepted';
          break;
        case 'Reject':
          title = 'Bid Rejected';
          break;
      }

      const response = await axios.post('https://exp.host/--/api/v2/push/send', {
        to: user.pushToken,
        title,
        body: message,
      }, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        }
      });

      console.log('Push notification sent:', response.data);
    }

    res.status(201).json({ status: "ok", data: "Notification created and push sent successfully." });
  } catch (error) {
    console.error("Error creating notification or sending push:", error);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});



app.get("/notifications", async (req, res) => {
  const token = req.headers.authorization;
  console.log(token)

  try {
    if (!token) {
      return res.status(401).json({ status: "error", error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(decoded._id)
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


server.listen(process.env.PORT, () => {
  console.log("Node js server started");
});
