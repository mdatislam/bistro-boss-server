const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.rjjf36d.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const foodCollection = client.db('Bistro-Boss').collection('foodItem')
        const reviewCollection = client.db('Bistro-Boss').collection('review')
        const cartCollection = client.db('Bistro-Boss').collection('cart')

        app.post('/food', async (req, res) => {
            console.log(user)
            const result = await foodCollection.insertOne(user)
            res.send(result)
        })

        app.get('/food', async (req, res) => {
            const result = await foodCollection.find({}).toArray()
            res.send(result)
        })

        app.get('/review', async (req, res) => {
            const result = await reviewCollection.find({}).toArray()
            res.send(result)
        })


        // cart collection

        app.post('/cart',async(req,res)=>{
            const cartInfo= req.body 
            //console.log(cartInfo)
            const result = await cartCollection.insertOne(cartInfo)
            res.send(result)
        })

        app.get('/carts',async(req,res)=>{
            const email= req.query.email
            //console.log(email)
            const result= await cartCollection.find({email:email}).toArray()
            res.send({data:result})
        })

         app.delete('/cart/:id',async(req,res)=>{
            const id= req.params.id
            //console.log(id)
            const result= await cartCollection.deleteOne({orderItemId:id})
            res.send(result)
        })


        console.log("connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send({ message: "Bistro-server Running" })
})

app.listen(port, () => console.log(`Bistro-server Running on ${port}`))