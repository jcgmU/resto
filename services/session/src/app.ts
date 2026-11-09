import express from 'express';
import { errorHandler } from './interfaces/http/middleware/errorHandler';
import { createTablesRouter } from './interfaces/http/tables.routes';
import { createSessionsRouter } from './interfaces/http/sessions.routes';
import {
  CreateTableUseCaseImpl,
  CreateTablesBatchUseCaseImpl,
  UpdateTablesBatchUseCaseImpl,
  UpdateSingleTableUseCaseImpl,
  DeleteTablesBatchUseCaseImpl,
  GenerateTableQrUseCaseImpl,
  RotateTableQrKeyUseCaseImpl,
} from './application/TableUseCases';
import {
  OpenTableSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
  GetTableSessionUseCaseImpl,
  ListTableSessionsUseCaseImpl,
} from './application/SessionUseCases';
import Redis from 'ioredis';
import { TableRepository, TableSessionRepository } from '@packages/shared-types';
import { RedisTableRepository } from './infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from './infrastructure/redis/RedisTableSessionRepository';
import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
} from './infrastructure/fakes/InMemorySessionAdapters';
import { JwtGuestTokenIssuer } from './infrastructure/security/JwtGuestTokenIssuer';
import { QrcodeGeneratorAdapter } from './infrastructure/qr/QrcodeGeneratorAdapter';
import { config } from './config';

export interface SessionAppDeps {
  tableRepo?: TableRepository;
  sessionRepo?: TableSessionRepository;
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

  // Health
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const redis = (deps?.tableRepo && deps?.sessionRepo) ? null : getRedisClient();
  const tableRepo: TableRepository =
    deps?.tableRepo || (new RedisTableRepository(redis!) as unknown as TableRepository);
  const sessionRepo: TableSessionRepository =
    deps?.sessionRepo || new RedisTableSessionRepository(redis!);
  if (tableRepo instanceof InMemoryTableRepository) {
    tableRepo.setSessionRepository(sessionRepo);
  }
  const tokenIssuer = new JwtGuestTokenIssuer(config.JWT_SECRET);
  const qrGenerator = new QrcodeGeneratorAdapter();

  const createTableUseCase = new CreateTableUseCaseImpl(tableRepo);
  const createTablesBatchUseCase = new CreateTablesBatchUseCaseImpl(tableRepo);
  const updateTablesBatchUseCase = new UpdateTablesBatchUseCaseImpl(tableRepo);
  const updateSingleTableUseCase = new UpdateSingleTableUseCaseImpl(tableRepo);
  const deleteTablesBatchUseCase = new DeleteTablesBatchUseCaseImpl(tableRepo);
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

  const openTableSessionUseCase = new OpenTableSessionUseCaseImpl(
    sessionRepo,
    tableRepo,
    tokenIssuer,
    config.SESSION_TTL_SECONDS
  );
  const closeTableSessionUseCase = new CloseTableSessionUseCaseImpl(sessionRepo);
  const getTableSessionUseCase = new GetTableSessionUseCaseImpl(sessionRepo);
  const listTableSessionsUseCase = new ListTableSessionsUseCaseImpl(sessionRepo);

  // Mount routers
  app.use(
    '/tables',
    createTablesRouter({
      tableRepo,
      createTableUseCase,
      createTablesBatchUseCase,
      updateTablesBatchUseCase,
      updateSingleTableUseCase,
      deleteTablesBatchUseCase,
      generateTableQrUseCase,
      rotateTableQrKeyUseCase,
    })
  );

  app.use(
    '/sessions',
    createSessionsRouter({
      openTableSessionUseCase,
      closeTableSessionUseCase,
      getTableSessionUseCase,
      listTableSessionsUseCase,
    })
  );

  // Error handling
  app.use(errorHandler);

  return app;
}
