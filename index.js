const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json())

// token Verification middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.send({ message: "Unauthorized User" })
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
    if (err) {
      return res.send({ message: "Invalid Token" })
    }
    req.decoded = decoded;
    next()
  })
}

// verify seller
const verifySeller = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query)
  if (user?.role !== "seller") {
    return res.send({ message: "Forbidden Access" })
  }
  next()
}

// mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wv413.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const userCollection = client.db("quickPonno").collection("users")
const productCollection = client.db("quickPonno").collection("products")

const dbConnect = async () => {
  try {
    client.connect();
    console.log('GadgetShop Database connect successfully');

    // get user
    app.get('/user/:email', async (req, res) => {
      const query = { email: req.params.email }
      const user = await userCollection.findOne(query)
      res.send(user)
    })

    // insert user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "User already exists" })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    // add product 
    app.post("/addProduct", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product)
      res.send(result)
    })

    // get product
    app.get("/all-product", async (req, res) => {
      const { title, sort, brand, category, page =  1 , limit = 9 } = req.query;
      const query = {}
      if (title) {
        query.title = { $regex: title, $options: "i" }
      }
      if (category) {
        query.category = { $regex: category, $options: "i" }
      }
      if (brand) {
        query.brand = brand;
      }

      const pageNumber = Number(page)
      const limitNumber = Number(limit)

      const sortOption = sort === "asc" ? 1 : -1

      const products = await productCollection
      .find(query)
      .skip((pageNumber - 1)*limitNumber)
      .limit(limitNumber)
      .sort({ price: sortOption })
      .toArray();

      const totalProducts = await productCollection.countDocuments(query)
     

      const categories = [...new Set (products.map(product => product.category))];
      
      const brands = [...new Set (products.map(product => product.brand))];

      res.send({products, brands, categories, totalProducts});
    })

    // wishlist 
    app.patch("/wishlist/add", async (req, res) => {
      const {userEmail, productId} = req.body

      const result = await userCollection.updateOne(
        { email: userEmail },
        { $addToSet: { wishlist: new ObjectId(String(productId)) }}
      );
      res.send(result)

    })

    // get wishlist products
    app.get("/wishlist/:userId", verifyJWT, async (req, res) => {
      const userId = req.params.userId
      const user = await userCollection.findOne({ _id: new ObjectId(String(userId)) 
      })

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

    

    })

  } catch (error) {
    console.log(error.name, error.message);
  }
}

dbConnect()
// api
app.get('/', (req, res) => {
  res.send('The Final Run Quick Ponno')
})

// jwt

app.post('/authentication', async (req, res) => {
  const userEmail = req.body
  const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, {
    expiresIn: '10d',
  });
  res.send({ token })
});

app.listen(port, () => {
  console.log(`QuickPonno Port is running on port: ${port}`);
})