import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Define colors for log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey',
};

// Tell winston about the colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`,
  ),
);

// Define transports
const transports: winston.transport[] = [];

// Console transport
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
    }),
  );
}

// File transports
if (process.env.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create stream for Morgan HTTP logger
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Export logger
export { logger };

// Log unhandled errors
if (process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

// Helper functions for structured logging
export const log = {
  // Request logging
  request: (req: any, message: string, data?: any) => {
    logger.info(message, {
      requestId: req.id,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
      ...data,
    });
  },

  // Error logging
  error: (error: Error | any, context?: any) => {
    logger.error(error.message || 'Unknown error', {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode,
      },
      ...context,
    });
  },

  // Performance logging
  performance: (operation: string, duration: number, metadata?: any) => {
    logger.info(`Performance: ${operation}`, {
      operation,
      duration,
      ...metadata,
    });
  },

  // Audit logging
  audit: (action: string, userId: string, entityType: string, entityId: string, changes?: any) => {
    logger.info(`Audit: ${action}`, {
      audit: {
        action,
        userId,
        entityType,
        entityId,
        changes,
        timestamp: new Date().toISOString(),
      },
    });
  },

  // Security logging
  security: (event: string, details: any) => {
    logger.warn(`Security: ${event}`, {
      security: {
        event,
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  },
};

export default logger;
