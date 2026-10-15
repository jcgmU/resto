import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './interfaces/graphql/typeDefs';
import { createResolvers } from './interfaces/graphql/resolvers';
import { buildCatalogContext, CatalogContext } from './interfaces/graphql/context';
import {
  CategoryRepository,
  ProductRepository,
  ModifierGroupRepository,
} from '@packages/shared-types';
import { PrismaClient } from './generated/client';
import { PrismaCategoryRepository } from './infrastructure/persistence/PrismaCategoryRepository';
import { PrismaProductRepository } from './infrastructure/persistence/PrismaProductRepository';
import { PrismaModifierGroupRepository } from './infrastructure/persistence/PrismaModifierGroupRepository';
import {
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemoryModifierGroupRepository,
} from './infrastructure/fakes/InMemoryCatalogAdapters';
import { internalAuthMiddleware } from './interfaces/http/internalAuth.middleware';
import { createUploadsRouter } from './interfaces/http/uploads.routes';

export interface CatalogAppDeps {
  categoryRepo?: CategoryRepository;
  productRepo?: ProductRepository;
  modifierGroupRepo?: ModifierGroupRepository;
  prisma?: PrismaClient;
  uploadDir?: string;
}

let defaultPrismaClient: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!defaultPrismaClient) {
    defaultPrismaClient = new PrismaClient();
  }
  return defaultPrismaClient;
}

export async function createCatalogApp(deps?: CatalogAppDeps): Promise<express.Application> {
  const app: express.Application = express();
  app.use(express.json());

  const usePrisma = !deps?.categoryRepo || !deps?.productRepo || !deps?.modifierGroupRepo;
  const prisma = deps?.prisma || (usePrisma ? getPrismaClient() : null);

  app.get('/health', async (_req, res) => {
    try {
      if (prisma) {
        await prisma.$queryRaw`SELECT 1`;
      }
      res.status(200).json({ status: 'ok', postgres: 'up' });
    } catch {
      res.status(503).json({ status: 'error', postgres: 'down' });
    }
  });

  app.use(internalAuthMiddleware);
  app.use('/uploads', createUploadsRouter({ uploadDir: deps?.uploadDir }));

  const categoryRepo = deps?.categoryRepo || new PrismaCategoryRepository(prisma!);
  const productRepo = deps?.productRepo || new PrismaProductRepository(prisma!);
  const modifierGroupRepo = deps?.modifierGroupRepo || new PrismaModifierGroupRepository(prisma!);

  const resolvers = createResolvers({
    categoryRepo,
    productRepo,
    modifierGroupRepo,
  });

  const server = new ApolloServer<CatalogContext>({
    typeDefs,
    resolvers,
    formatError: (formattedError, error: any) => {
      const original = error?.originalError;
      if (original && original.code) {
        let code = original.code;
        if (code === 'VALIDATION_ERROR') code = 'BAD_USER_INPUT';
        return {
          ...formattedError,
          extensions: {
            ...formattedError.extensions,
            code,
          },
        };
      }
      return formattedError;
    },
  });

  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        return buildCatalogContext({ req });
      },
    })
  );

  return app;
}
