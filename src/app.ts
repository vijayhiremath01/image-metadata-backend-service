import express, { type Express, type Request, type Response } from 'express';
import rateLimit from "express-rate-limit";
import cors from "cors";
import photoRoutes from "@/router/photo.routes";
import categoryRoutes from "@/router/category.routes";
import authRoutes from "@/router/auth.routes";
import userRoutes from "@/router/user.routes";
import followRoutes from "@/router/follow.routes";
import boardRoutes from "@/router/board.routes";
import commentRoutes from "@/router/comment.routes";
import publicProfileRoutes from "@/router/publicProfile.routes";
import "dotenv/config";

const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    handler: (req: Request, res: Response) => {
        console.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later.'
        })
    }
})

const app: Express = express();
const port = 3000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://10.53.65.204:3000',
  'https://your-frontend-domain.com',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.match(/^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+):\d+$/)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(globalLimiter);
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Halo Wallpaper Backend API 🚀",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "Healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users', followRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/photos', commentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', publicProfileRoutes);

export default app;