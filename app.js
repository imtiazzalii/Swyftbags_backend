const express = require("express")
const app = express();
const mongoose = require("mongoose");
app.use(express.json());
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
var bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
// app.use(function (req, res) {
//     res.setHeader('Content-Type', 'text/plain')
//     res.write('you posted:\n')
//     // res.end(JSON.stringify(req.body, null, 2))
//   })

const mongoUrl= "mongodb+srv://imtiazmushfiq01:admin@imtiaz786.uncwcpb.mongodb.net/?retryWrites=true&w=majority"

const JWT_SECRET = "nejneineiugnvsuiegnergn885r7437378357485843548rwreuhgafbgasibfwaubgawug8qr784578(){}nvbdvj{}";

mongoose.connect(mongoUrl).then(()=>{console.log("Database connected")})
.catch((e)=>{
    console.log(e);
});
require('./userDetail')
const User=mongoose.model("UserInfo");

app.get("/",(req,res)=>{

    res.send({status:"Started"})
})

app.post('/Signup',async(req,res)=>{
    const {name,email,password,confirmPassword,cnic,address,phoneNumber,profilePic,frontCNIC,backCNIC} = req.body;

    const oldUser = await User.findOne({email:email});

    if(oldUser)
    {
        return res.send({ data : "user already exist!!"})
    }
    encyptedPassword = await bcrypt.hash(password,10);

    try{
        await User.create({
            name:name,
            email:email,
            password:encyptedPassword,
            confirmPassword:confirmPassword,
            cnic:cnic,
            address:address,
            phoneNumber:phoneNumber,
            profilePic:profilePic,
            frontCNIC:frontCNIC,
            backCNIC:backCNIC,



        });
        res.send({status:"ok", data:"User created"})
        console.log(profilePic)
    }
    catch(error) {
        res.send({status:"error", data:"error"});
    }
});

app.post('/Login', async (req, res) => {
    const { Email, Password } = req.body;

    try {
        const user = await User.findOne({ email: Email });

        if (!user) {
            return res.status(400).json({ status: "error", error: "User does not exist" });
        }

        const isPasswordValid = await bcrypt.compare(Password, user.password);

        if (!isPasswordValid) {
            return res.status(400).json({ status: "error", error: "Invalid password" });
        }

        const token = jwt.sign({ email: user.email }, JWT_SECRET);

        res.status(200).json({ status: "ok", data: token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ status: "error", error: "Internal server error" });
    }
});



app.post('/userData',async(req,res)=>
{

    const {token} = req.body;

    try {

        const user =jwt.verify(token,JWT_SECRET)
        const useremail = user.email;

        User.findOne({email:useremail}).then((data=>{
            return res.send({status:"ok", data: data});
        }));
        
    } catch (error) {
        return res.send({error: error});
    }



})


app.listen(5001,()=>{
    console.log("Node js server started");
});