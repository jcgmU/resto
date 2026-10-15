import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.GATEWAY_PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-oleada-0',
  internalSharedSecret: process.env.INTERNAL_SHARED_SECRET || 'resto-internal-shared-secret-dev-2026',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  services: {
    identity: process.env.IDENTITY_SERVICE_URL || 'http://localhost:4001',
    catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:4002',
    session: process.env.SESSION_SERVICE_URL || 'http://localhost:4003',
    ordering: process.env.ORDERING_SERVICE_URL || 'http://localhost:4004',
  },
};
