import express, { type Express, type Request, type Response } from 'express';
import rateLimit from "express-rate-limit";


const limiter = rateLimit({
    windowMs : 60 * 1000,
    max : 3 ,
    handler : (req : Request , res : Response) => {
        console.warn(`Rate limit exceeded for IP: ${req.ip}`);
         res.status(429).json({
        message : 'Too many requests, please try again later.'
    })
    }
})

const app: Express = express();
const port = 3000 ; 


app.use(limiter);

app.get('/', (req : Request , res : Response) => {
    res.send('Hello World!');
})

export default app;