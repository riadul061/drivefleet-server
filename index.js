const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
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

const logger = (req, res, next) => {
    console.log(`${req.method} | ${req.url}`);
    next();
};

const verifyToken = async (req, res, next) => {
    const { authorization } = req.headers;
    const token = authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorize' });
    }

    try {
        const JWKS = createRemoteJWKSet(new URL('http://localhost:3000/api/auth/jwks'));
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        next();
    } catch (error) {
        console.error('Token validation failed:', error);
        return res.status(401).json({ message: 'Unauthorize' });
    }
};

async function run() {
    try {
        await client.connect();

        const db = client.db('drivefleetdb');
        const carsCollection = db.collection('cars');
        const PricingCollection = db.collection('Pricing');
        const exploreCollection = db.collection('explore');
        const bookingsCollection = db.collection('bookings');

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
                const result = await carsCollection.findOne({ _id: new ObjectId(carsId) });
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

        // GET all explore cars (with search & filter)
        app.get('/explore', async (req, res) => {
            try {
                const search = req.query.search || '';
                const type = req.query.type || '';

                let query = {};

                if (search) {
                    query.carName = { $regex: search, $options: 'i' };
                }

                if (type) {
                    query.carType = type;
                }

                const result = await exploreCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch explore', error });
            }
        });

        // POST add new explore car — ✅ verifyToken + userId backend থেকে set
        app.post('/explore', verifyToken, async (req, res) => {
            try {
                const carData = req.body;
                carData.userId = req.user.sub || req.user.id;
                carData.createdAt = new Date().toISOString();
                const result = await exploreCollection.insertOne(carData);
                res.status(201).send({ message: 'Car added successfully', id: result.insertedId });
            } catch (error) {
                res.status(500).send({ message: 'Failed to add car', error });
            }
        });

        // GET single explore car
        app.get('/explore/:exploreId', logger, async (req, res) => {
            try {
                const { exploreId } = req.params;
                if (!ObjectId.isValid(exploreId)) {
                    return res.status(400).send({ message: 'Invalid car ID' });
                }
                const result = await exploreCollection.findOne({ _id: new ObjectId(exploreId) });
                if (!result) {
                    return res.status(404).send({ message: 'Car not found' });
                }
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch car', error });
            }
        });

        // UPDATE CAR
        app.put('/explore/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const updatedCar = req.body;
                const filter = { _id: new ObjectId(id) };
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
                const result = await exploreCollection.updateOne(filter, updatedDoc);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to update car', error });
            }
        });

        // DELETE CAR — ✅ exploreCollection এ delete হচ্ছে
        app.delete('/explore/:id', verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const result = await exploreCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to delete car', error });
            }
        });

        // PATCH — Book a car
        app.patch('/explore/:exploreId', verifyToken, async (req, res) => {
            try {
                const { exploreId } = req.params;
                const bookingData = req.body;

                if (!ObjectId.isValid(exploreId)) {
                    return res.status(400).json({ message: 'Invalid car ID' });
                }

                const explore = await exploreCollection.findOne({
                    _id: new ObjectId(exploreId)
                });

                if (!explore) {
                    return res.status(404).json({ message: 'Car not found' });
                }

                // bookingCount বাড়াও
                await exploreCollection.updateOne(
                    { _id: new ObjectId(exploreId) },
                    {
                        $inc: { bookingCount: 1 },
                        $set: { lastBookedAt: new Date() }
                    }
                );

                // bookingsCollection এ save করো
                const result = await bookingsCollection.insertOne({
                    ...bookingData,
                    carId: exploreId,
                    bookedAt: new Date()
                });

                res.send(result);
            } catch (err) {
                console.error("Booking error:", err.message);
                res.status(500).json({ message: err.message });
            }
        });

        // GET my bookings
        app.get('/my-bookings', verifyToken, async (req, res) => {
            try {
                const userId = req.user.sub || req.user.id;
                const bookings = await bookingsCollection
                    .find({ userId: userId })
                    .toArray();
                res.send(bookings);
            } catch (err) {
                console.error("My bookings error:", err.message);
                res.status(500).json({ message: err.message });
            }
        });

        // GET my added cars
        app.get('/my-cars', verifyToken, async (req, res) => {
            try {
                const userId = req.user.sub || req.user.id;
                const cars = await exploreCollection
                    .find({ userId: userId })
                    .toArray();
                res.send(cars);
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
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