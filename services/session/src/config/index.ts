import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '4003', 10),
  SESSION_TTL_SECONDS: parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10),
  PWA_BASE_URL: process.env.PWA_BASE_URL || 'http://localhost:3001',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-oleada-0',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  IDENTITY_INTERNAL_URL: process.env.IDENTITY_INTERNAL_URL || process.env.IDENTITY_URL || 'http://localhost:4001',
  ORDERING_INTERNAL_URL: process.env.ORDERING_INTERNAL_URL || process.env.ORDERING_URL || 'http://localhost:4004',
};
