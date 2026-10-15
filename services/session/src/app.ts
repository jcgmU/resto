import express from 'express';
import { errorHandler } from './interfaces/http/middleware/errorHandler';
import { createTablesRouter } from './interfaces/http/tables.routes';
import { createSessionsRouter } from './interfaces/http/sessions.routes';
import { createZonesRouter } from './interfaces/http/zones.routes';
import { createReservationsRouter } from './interfaces/http/reservations.routes';
import {
  CreateTableUseCaseImpl,
  GenerateTableQrUseCaseImpl,
  RotateTableQrKeyUseCaseImpl,
} from './application/TableUseCases';
import {
  OpenTableSessionUseCaseImpl,
  StaffOpenSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
  GetTableSessionUseCaseImpl,
  ListTableSessionsUseCaseImpl,
  RequestBillSessionUseCaseImpl,
  ReopenBillSessionUseCaseImpl,
} from './application/SessionUseCases';
import Redis from 'ioredis';
import {
  TableRepository,
  TableSessionRepository,
  ZoneRepository,
  ReservationRepository,
  IdentitySettingsPort,
} from '@packages/shared-types';
import { HttpIdentitySettingsAdapter } from './infrastructure/identity/HttpIdentitySettingsAdapter';
import { RedisTableRepository } from './infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from './infrastructure/redis/RedisTableSessionRepository';
import { RedisZoneRepository } from './infrastructure/redis/RedisZoneRepository';
import { RedisReservationRepository } from './infrastructure/redis/RedisReservationRepository';
import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
  InMemoryZoneRepository,
  InMemoryReservationRepository,
} from './infrastructure/fakes/InMemorySessionAdapters';
import { JwtGuestTokenIssuer } from './infrastructure/security/JwtGuestTokenIssuer';
import { QrcodeGeneratorAdapter } from './infrastructure/qr/QrcodeGeneratorAdapter';
import { internalAuthMiddleware } from './interfaces/http/internalAuth.middleware';
import { config } from './config';

export interface SessionAppDeps {
  tableRepo?: TableRepository;
  sessionRepo?: TableSessionRepository;
  zoneRepo?: ZoneRepository;
  reservationRepo?: ReservationRepository;
  identitySettings?: IdentitySettingsPort;
  redis?: Redis;
}

let defaultRedisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!defaultRedisClient) {
    defaultRedisClient = new Redis(config.REDIS_URL || 'redis://localhost:6379');
  }
  return defaultRedisClient;
}

export function createSessionApp(deps?: SessionAppDeps): express.Application {
  const app: express.Application = express();
  app.use(express.json());

  const redis = deps?.redis || ((deps?.tableRepo && deps?.sessionRepo) ? null : getRedisClient());

  // Health
  app.get('/health', async (_req, res) => {
    try {
      if (redis) {
        await redis.ping();
      }
      res.status(200).json({ status: 'ok', redis: 'up' });
    } catch {
      res.status(503).json({ status: 'error', redis: 'down' });
    }
  });

  app.use(internalAuthMiddleware);

  const tableRepo = deps?.tableRepo || (redis ? new RedisTableRepository(redis) : new InMemoryTableRepository());
  const sessionRepo = deps?.sessionRepo || (redis ? new RedisTableSessionRepository(redis) : new InMemoryTableSessionRepository());
  const zoneRepo = deps?.zoneRepo || (redis ? new RedisZoneRepository(redis) : new InMemoryZoneRepository());
  const reservationRepo = deps?.reservationRepo || (redis ? new RedisReservationRepository(redis) : new InMemoryReservationRepository());

  const tokenIssuer = new JwtGuestTokenIssuer(config.JWT_SECRET);
  const qrGenerator = new QrcodeGeneratorAdapter();

  const createTableUseCase = new CreateTableUseCaseImpl(tableRepo, zoneRepo);
  const generateTableQrUseCase = new GenerateTableQrUseCaseImpl(
    tableRepo,
    qrGenerator,
    config.PWA_BASE_URL
  );
  const rotateTableQrKeyUseCase = new RotateTableQrKeyUseCaseImpl(
    tableRepo,
    qrGenerator,
    config.PWA_BASE_URL
  );

  const identitySettings =
    deps?.identitySettings || new HttpIdentitySettingsAdapter(config.IDENTITY_INTERNAL_URL);

  const openTableSessionUseCase = new OpenTableSessionUseCaseImpl(
    sessionRepo,
    tableRepo,
    tokenIssuer,
    config.SESSION_TTL_SECONDS,
    reservationRepo,
    identitySettings
  );
  const staffOpenSessionUseCase = new StaffOpenSessionUseCaseImpl(
    sessionRepo,
    tableRepo,
    config.SESSION_TTL_SECONDS
  );
  const closeTableSessionUseCase = new CloseTableSessionUseCaseImpl(sessionRepo);
  const getTableSessionUseCase = new GetTableSessionUseCaseImpl(sessionRepo);
  const listTableSessionsUseCase = new ListTableSessionsUseCaseImpl(sessionRepo);
  const requestBillSessionUseCase = new RequestBillSessionUseCaseImpl(sessionRepo);
  const reopenBillSessionUseCase = new ReopenBillSessionUseCaseImpl(sessionRepo);

  // Mount routers
  app.use(
    '/zones',
    createZonesRouter({
      zoneRepo,
      tableRepo,
    })
  );

  app.use(
    '/reservations',
    createReservationsRouter({
      reservationRepo,
      tableRepo,
      sessionRepo,
    })
  );

  app.use(
    '/tables',
    createTablesRouter({
      tableRepo,
      createTableUseCase,
      generateTableQrUseCase,
      rotateTableQrKeyUseCase,
      sessionRepo,
      zoneRepo,
      reservationRepo,
    })
  );

  const sessionsRouter = createSessionsRouter({
    openTableSessionUseCase,
    staffOpenSessionUseCase,
    closeTableSessionUseCase,
    getTableSessionUseCase,
    listTableSessionsUseCase,
    requestBillSessionUseCase,
    reopenBillSessionUseCase,
  });

  app.use('/sessions', sessionsRouter);
  app.use('/v1/sessions', sessionsRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
