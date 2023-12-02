const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(403).send({ msg: 'unauthorize access' })
    }
    const token = authHeader.split(' ')[1]
    //console.log(token)
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(401).send({ msg: 'Access forbidden' })
        }
        req.decoded = decoded
        next()
    });


}




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
        const userCollection = client.db('Bistro-Boss').collection('user')
        const paymentCollection = client.db('Bistro-Boss').collection('payments')

        /* JWT api */
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' });
            res.send({ token: token })
        })
        // Warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next()
        }

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find({}).toArray()
            res.send({ users: result })
        })

        /* Check Admin api */

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const userEmail = req.params.email
            if (req.decoded.email !== userEmail) {
                res.send({ admin: false })
            }
            const query = { email: userEmail }
            const userInfo = await userCollection.findOne(query)
            const result = { admin: userInfo?.role === 'admin' }
            res.send(result)

        })


        app.post('/users', verifyJWT, async (req, res) => {
            const userInfo = req.body
            const query = { email: userInfo.email }

            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ msg: 'user exist' })
            }
            const result = await userCollection.insertOne(userInfo)
            res.send(result)
        })

        app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            //console.log(filter)
            const updateDocs = {
                $set: {
                    role: 'admin'
                }
            }

            const result = await userCollection.updateOne(filter, updateDocs)
            res.send(result)
        })

        app.delete('/users/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            //console.log(id)
            const filter = { _id: new ObjectId(id) }
            // console.log(filter)
            const result = await userCollection.deleteOne(filter)
            res.send(result)
        })

        app.post('/food', verifyJWT, async (req, res) => {
            const foodInfo = req.body
            //console.log(user)
            const result = await foodCollection.insertOne(foodInfo)
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

        app.post('/cart', verifyJWT, async (req, res) => {
            const cartInfo = req.body
            //console.log(cartInfo)
            const result = await cartCollection.insertOne(cartInfo)
            res.send(result)
        })

        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email
            //console.log(email)
            const result = await cartCollection.find({ email: email }).toArray()
            res.send({ data: result })
        })

        app.delete('/cart/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            //console.log(id)
            const result = await cartCollection.deleteOne({ orderItemId: id })
            res.send(result)
        })
        // create payment intent api
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body
            const amount = price * 100
            //console.log(amount)

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // save payment info

        app.post('/payment',verifyJWT,async(req,res)=>{
            const paymentInfo= req.body 
            const insertPayment = await paymentCollection.insertOne(paymentInfo)
            const query= {_id:{$in:paymentInfo.cartItems.map(id=> new ObjectId(id))}}
            const deletePaidItems= await cartCollection.deleteMany(query)
            res.send({insertPayment,deletePaidItems})
        })

        // Resturent summary api

        app.get('/admin-states',verifyJWT, verifyAdmin,async(req,res)=>{
            const totalCustomer= await userCollection.estimatedDocumentCount() 
            const totalProducts= await foodCollection.estimatedDocumentCount() 
            const totalOrder = await paymentCollection.estimatedDocumentCount()
            // to use reduce function
            const  payments = await paymentCollection.find({}).toArray()
            const totalRevenue = payments.reduce((sum,payment)=>sum+payment.price,0)

            // to use group operator
            const revenue= await paymentCollection.aggregate([
                {
                    $group:{
                        _id:null,
                        total:{$sum:'$price'}
                    }
                }
            ]).toArray()
           // console.log(revenue)
            const totalRevenue2= revenue[0].total
            res.send({totalCustomer,totalProducts, totalOrder,totalRevenue,totalRevenue2})


        })

        app.get('/order-states',async(req,res)=>{
            const pipeline=[
                {
                    $lookup:{
                        from:"foodItem",
                        localField:"menuItems",
                        foreignField:"_id",
                        as:'menuItemData'
                    }
                },
                 {
                    $unwind:"$menuItemData"
                },
                  {
                    $group:{
                        _id:"$menuItemData.category",
                        count:{$sum:1},
                        totalAmount:{$sum:"$menuItemData.price"}
                    }
                },
                {
                    $project:{
                        category:"$_id",
                        count:1,
                        totalAmount:{$round:["$totalAmount",2]},
                        _id:0
                    }
                }  
            ]
            const result= await paymentCollection.aggregate(pipeline).toArray()
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