import express, { type Express, type Request, type Response } from 'express';
import rateLimit from "express-rate-limit";
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