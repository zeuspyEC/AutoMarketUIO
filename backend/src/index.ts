import express, { Application, Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import configurations
import { dbConfig } from './config/database';
import { redisClient } from './config/redis';
import { rabbitMQConnection } from './config/rabbitmq';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';
import { metricsMiddleware } from './middleware/metrics';

// Import routes
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { vehicleRoutes } from './routes/vehicle.routes';
import { transactionRoutes } from './routes/transaction.routes';
import { commissionRoutes } from './routes/commission.routes';
import { searchRoutes } from './routes/search.routes';
import { uploadRoutes } from './routes/upload.routes';
import { healthRoutes } from './routes/health.routes';

// Import services
import { initializeServices } from './services';
import { swaggerSpec } from './config/swagger';

// Create Express app
const app: Application = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
  }
});

// Global middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Metrics
app.use(metricsMiddleware);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check (unauthenticated)
app.use('/api/health', healthRoutes);

// API Routes
const apiPrefix = process.env.API_PREFIX || '/api/v1';

// Public routes
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/search`, searchRoutes);

// Protected routes
app.use(`${apiPrefix}/users`, authMiddleware, userRoutes);
app.use(`${apiPrefix}/vehicles`, vehicleRoutes); // Mixed auth - some endpoints public
app.use(`${apiPrefix}/transactions`, authMiddleware, transactionRoutes);
app.use(`${apiPrefix}/commissions`, authMiddleware, commissionRoutes);
app.use(`${apiPrefix}/upload`, authMiddleware, uploadRoutes);

// Socket.IO setup for real-time features
io.on('connection', (socket) => {
  logger.info(`New WebSocket connection: ${socket.id}`);

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    logger.info(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on('leave-room', (roomId: string) => {
    socket.leave(roomId);
    logger.info(`Socket ${socket.id} left room ${roomId}`);
  });

  socket.on('chat-message', (data: any) => {
    io.to(data.roomId).emit('new-message', data);
  });

  socket.on('vehicle-update', (data: any) => {
    io.emit('vehicle-updated', data);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket ${socket.id} disconnected`);
  });
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connections
  try {
    await dbConfig.destroy();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }

  // Close Redis connection
  try {
    await redisClient.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }

  // Close RabbitMQ connection
  try {
    await rabbitMQConnection.close();
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  }

  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Initialize services and start server
const startServer = async () => {
  try {
    // Initialize database
    await dbConfig.raw('SELECT 1');
    logger.info('Database connection established');

    // Initialize Redis
    await redisClient.ping();
    logger.info('Redis connection established');

    // Initialize services
    await initializeServices();
    logger.info('Services initialized');

    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Export app for testing
export { app, server, io };
