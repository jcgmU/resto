import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.ORDERING_PORT || '4004', 10),
  databaseUrl:
    process.env.ORDERING_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/resto_ordering?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/1',
  catalogInternalUrl:
    process.env.CATALOG_INTERNAL_URL || 'http://localhost:4002/graphql',
  sessionInternalUrl:
    process.env.SESSION_INTERNAL_URL || 'http://localhost:4003',
  cartTtlSeconds: parseInt(process.env.CART_TTL_SECONDS || '14400', 10),
  cartPollIntervalMs: parseInt(process.env.CART_POLL_INTERVAL_MS || '5000', 10),
  serviceCallTtlSeconds: parseInt(process.env.SERVICE_CALL_TTL_SECONDS || '7200', 10),
  identityInternalUrl:
    process.env.IDENTITY_INTERNAL_URL ||
    process.env.IDENTITY_URL ||
    'http://localhost:4001',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-oleada-0',
};
