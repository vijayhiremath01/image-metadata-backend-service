import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
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

// Trust proxy for reverse proxy (nginx) support
app.set("trust proxy", 1);

// Security headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow ImageKit images
  contentSecurityPolicy: false, // Disable CSP to avoid issues with ImageKit
  xPoweredBy: false, // Hide Express fingerprint
}));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://13.60.74.79:3000',
];

// Add production frontend URL from env
const frontendUrl = process.env.FRONTEND_URL;
if (frontendUrl) {
  allowedOrigins.push(frontendUrl);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
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

// Handle preflight requests
app.options("*", cors());

// Request logging middleware (excludes sensitive data)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Capture original end to log after response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    const sanitizedUrl = req.url.replace(/\/api\/auth\/(login|register|refresh)/, '/api/auth/[auth]');
    
    console.log(`${req.method} ${sanitizedUrl} ${res.statusCode} ${duration}ms`);
    
    return originalEnd(chunk, encoding, cb);
  } as typeof res.end;
  
  next();
});

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
    status: "ok",
    service: "HALO Backend",
    uptime: process.uptime(),
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