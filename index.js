const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
var jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctors-portal.dzzpy.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    console.log(token);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Access" })
        }
        req.decoded = decoded;
        console.log(decoded)
        next();
    });




}

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctor_portal').collection('services');
        const bookingCollection = client.db('doctor_portal').collection('bookings');
        const usersCollection = client.db('doctor_portal').collection('users');
        app.get('/user', async (req, res) => {
            const query = {};
            const cursor = usersCollection.find(query);
            const user = await cursor.toArray();
            res.send(user);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        app.put('/user/admin/:email', async (req, res) => {
            const email = req.params.email;

            // const requester = req.decoded.email;
            // const requesterAccount = await usersCollection.findOne({ email: requester });
            // if (requesterAccount.role === 'admin') {
            //     const filter = { email: email };
            //     const doc = {
            //         $set: { role: 'admin' },
            //     }
            //     const result = await usersCollection.updateOne(filter, doc);
            //     res.send(result);
            // }
            // else {
            //     res.status(403).send({ message: "Forbidden" });
            // }


            const filter = { email: email };
            const doc = {
                $set: { role: 'admin' },
            }
            const result = await usersCollection.updateOne(filter, doc);
            res.send(result);
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const option = { upsert: true };
            const doc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(filter, doc, option);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, token });
        })

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // step 1 : get all services 
            const services = await servicesCollection.find().toArray();

            // step 2 : get the booking of that day 
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            // step 3: for each service

            services.forEach(service => {
                //step 4 : find booking for that service 

                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // step 5 : select slots for the serviceBookings
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step 6: select those slots that are not in booked slots 
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                // step 7: set available to slots to make it easier 
                service.slots = available;
            })
            res.send(services);

        })



        app.get('/booking', async (req, res) => {
            const patient = req.query.patient;

            const query = { patient: patient };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient, slot: booking.slot };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })


    }
    finally {

    }

}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Doctors Server Running')
})


app.listen(port, () => {
    console.log(`Listening to Port : ${port}`)
})