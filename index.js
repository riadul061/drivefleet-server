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
        const PricingCollection = db.collection('Pricing');
        const exploreCollection = db.collection('explore');

        // GET all cars
        app.get('/cars', async (req, res) => {
            try {
                const result = await carsCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch cars', error });
            }
        });

        // GET single car
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

        // GET Pricing
        app.get('/Pricing', async (req, res) => {
            try {
                const result = await PricingCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch pricing', error });
            }
        });

        // GET all explore cars
        app.get('/explore', async (req, res) => {
            try {
                const result = await exploreCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch explore', error });
            }
        });

        // POST add new explore car
        app.post('/explore', async (req, res) => {
            try {
                const carData = req.body;
                carData.createdAt = new Date().toISOString();
                const result = await exploreCollection.insertOne(carData);
                res.status(201).send({ message: 'Car added successfully', id: result.insertedId });
            } catch (error) {
                res.status(500).send({ message: 'Failed to add car', error });
            }
        });

        // GET single explore car
        app.get('/explore/:exploreId', async (req, res) => {
            try {
                const { exploreId } = req.params;

                if (!ObjectId.isValid(exploreId)) {
                    return res.status(400).send({ message: 'Invalid car ID' });
                }

                const query = { _id: new ObjectId(exploreId) };
                const result = await exploreCollection.findOne(query);

                if (!result) {
                    return res.status(404).send({ message: 'Car not found' });
                }

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch car', error });
            }
        });
         // UPDATE CAR
        app.put('/explore/:id', async (req, res) => {

            const id = req.params.id;

            const updatedCar = req.body;

            const filter = {
                _id: new ObjectId(id),
            };

            const updatedDoc = {
                $set: {
                    dailyRentPrice: updatedCar.dailyRentPrice,
                    image: updatedCar.image,
                    carType: updatedCar.carType,
                    pickupLocation: updatedCar.pickupLocation,
                    availability: updatedCar.availability,
                    description: updatedCar.description,
                },
            };

            const result = await carsCollection.updateOne(
                filter,
                updatedDoc
            );

            res.send(result);
        });

        // DELETE CAR
        app.delete('/explore/:id', async (req, res) => {

            const id = req.params.id;

            const query = {
                _id: new ObjectId(id),
            };

            const result = await carsCollection.deleteOne(query);

            res.send(result);
        });

        console.log("Successfully connected to MongoDB!");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

run();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});