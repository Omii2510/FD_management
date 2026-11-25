import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import healthRouter from './routes/health.routes.js';
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import bankRouter from './routes/bank.routes.js';
import fdPlanRouter from './routes/fdPlan.routes.js';
import fdCalculatorRouter from './routes/fdCalculator.routes.js';
import adRouter from './routes/ad.routes.js';
import adminRouter from './routes/admin.routes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL?.split(',').map((origin) => origin.trim()).filter(Boolean) || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging (dev only)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/banks', bankRouter);
app.use('/api/v1/fd-plans', fdPlanRouter);
app.use('/api/v1/fd', fdCalculatorRouter);
app.use('/api/v1/advertisements', adRouter);
app.use('/api/v1/admin', adminRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Centralised error handler
app.use(errorHandler);

export default app;
