import knex from 'knex';
import { Model } from 'objection';
import { logger } from '../utils/logger';

// Database configuration
const dbConfig = knex({
  client: 'postgresql',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
  debug: process.env.NODE_ENV === 'development',
  asyncStackTraces: process.env.NODE_ENV === 'development',
  log: {
    warn(message: string) {
      logger.warn('Database warning:', message);
    },
    error(message: string) {
      logger.error('Database error:', message);
    },
    deprecate(message: string) {
      logger.warn('Database deprecation:', message);
    },
    debug(message: string) {
      logger.debug('Database debug:', message);
    },
  },
});

// Give the knex instance to objection
Model.knex(dbConfig);

// Test database connection
dbConfig.raw('SELECT 1')
  .then(() => {
    logger.info('Database connection established successfully');
  })
  .catch((error) => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });

// Export configuration
export { dbConfig };
export default dbConfig;
