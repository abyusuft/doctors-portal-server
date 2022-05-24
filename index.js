const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctors-portal.dzzpy.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctor_portal').collection('services');
        const bookingCollection = client.db('doctor_portal').collection('bookings');

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