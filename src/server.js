import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { setupSocket } from './socket/socketHandler.js';

dotenv.config();

// Validate required environment variables
const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);
if (missingEnv.length > 0) {
  console.error(`CRITICAL ERROR: Missing environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Optional DNS override for restricted environments.
// Example: MONGO_DNS_SERVERS=8.8.8.8,8.8.4.4
if (process.env.MONGO_DNS_SERVERS) {
  const dns = await import('dns');
  const servers = process.env.MONGO_DNS_SERVERS
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    dns.default.setServers(servers);
    console.log(`Using custom DNS servers for MongoDB SRV lookup: ${servers.join(', ')}`);
  }
}

const app = express();

const allowedOrigins = (() => {
  const fromEnv = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Keep local dev ergonomic when frontend runs on either default React port.
  return Array.from(new Set([...fromEnv, 'http://localhost:3000', 'http://localhost:3001']));
})();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
// Webhook must receive raw body for signature verification.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('CRITICAL: MongoDB connection error.');
    console.error('Technical details:', err.message);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/payments', paymentRoutes);

// Socket.io setup
setupSocket(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const BASE_PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_RETRIES = 10;

const listenWithRetry = (port, attempt = 0) => {
  httpServer.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_RETRIES) {
      const nextPort = port + 1;
      console.error(`Port ${port} is in use. Retrying on ${nextPort}...`);
      return listenWithRetry(nextPort, attempt + 1);
    }

    if (error.code === 'EADDRINUSE') {
      console.error(
        `Unable to bind server after ${MAX_PORT_RETRIES + 1} attempts starting from port ${BASE_PORT}.`
      );
    } else {
      console.error('Server start error:', error);
    }
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

const startServer = async () => {
  await connectDatabase();
  listenWithRetry(BASE_PORT);
};

startServer();
