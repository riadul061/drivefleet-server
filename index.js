const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); 

const port = process.env.PORT || 8080;


const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db('drivefleetdb');
    const carsCollection = db.collection('cars');

    app.get('/cars', async (req, res) => {
      try { 
        const result = await carsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch cars', error });
      }
    });

    app.get('/cars/:carsId', async (req, res) => {
      try { 
        const { carsId } = req.params;

        if (!ObjectId.isValid(carsId)) {
          return res.status(400).send({ message: 'Invalid car ID' });
        }

        const query = { _id: new ObjectId(carsId) };
        const result = await carsCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: 'Car not found' });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch car', error });
      }
    });

    console.log("Successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1); // Stop server if DB connection fails
  }
}

run();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});