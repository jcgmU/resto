import express, { Request, Response, NextFunction } from 'express';
import { DomainError, TenantRepository, UserRepository, RefreshTokenRepository } from '@packages/shared-types';
import { RegisterTenantUseCaseImpl } from './application/RegisterTenant';
import { LoginUseCaseImpl } from './application/Login';
import { RefreshSessionUseCaseImpl } from './application/RefreshSession';
import { InviteUserUseCaseImpl } from './application/InviteUser';
import { ManageTeamUseCaseImpl } from './application/ManageTeam';
import { ChangePasswordUseCaseImpl } from './application/ChangePassword';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher';
import { JwtTokenIssuer } from './infrastructure/security/JwtTokenIssuer';
import { PrismaClient } from './generated/client';
import { PrismaTenantRepository } from './infrastructure/prisma/PrismaTenantRepository';
import { PrismaUserRepository } from './infrastructure/prisma/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma/PrismaRefreshTokenRepository';

export interface IdentityAppDeps {
  tenantRepo?: TenantRepository;
  userRepo?: UserRepository;
  refreshTokenRepo?: RefreshTokenRepository;
}

let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

export function createIdentityApp(deps?: IdentityAppDeps): express.Application {
  const app: express.Application = express();
  app.use(express.json());

  const usePrisma = !deps?.tenantRepo || !deps?.userRepo || !deps?.refreshTokenRepo;
  const prisma = usePrisma ? getPrisma() : null;

  const tenantRepo = deps?.tenantRepo || new PrismaTenantRepository(prisma!);
  const userRepo = deps?.userRepo || new PrismaUserRepository(prisma!);
  const refreshTokenRepo = deps?.refreshTokenRepo || new PrismaRefreshTokenRepository(prisma!);
  const sharedPasswordHasher = new BcryptPasswordHasher();
  const sharedTokenIssuer = new JwtTokenIssuer();

  const registerTenant = new RegisterTenantUseCaseImpl(
    tenantRepo,
    userRepo,
    refreshTokenRepo,
    sharedPasswordHasher,
    sharedTokenIssuer
  );

  const login = new LoginUseCaseImpl(
    tenantRepo,
    userRepo,
    refreshTokenRepo,
    sharedPasswordHasher,
    sharedTokenIssuer
  );

  const refreshSession = new RefreshSessionUseCaseImpl(
    userRepo,
    refreshTokenRepo,
    sharedTokenIssuer
  );

  const inviteUser = new InviteUserUseCaseImpl(userRepo, sharedPasswordHasher);
  const manageTeam = new ManageTeamUseCaseImpl(userRepo, refreshTokenRepo, sharedPasswordHasher);
  const changePassword = new ChangePasswordUseCaseImpl(userRepo, refreshTokenRepo, sharedPasswordHasher);

  // Health
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Auth routes
  app.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerTenant.execute(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await login.execute(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await refreshSession.execute(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/change-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || req.body.userId;
      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      await changePassword.execute({
        userId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
      });

      res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
    } catch (err) {
      next(err);
    }
  });

  // Identity routes
  app.get('/identity/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!userId || !tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      const user = await userRepo.findById(userId);
      if (user) {
        return res.status(200).json(user);
      }

      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/identity/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = req.headers['x-user-role'] as string;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      if (role !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Permiso denegado. Se requiere rol ADMIN',
          },
        });
      }

      const users = await manageTeam.listUsers(tenantId);
      res.status(200).json(users);
    } catch (err) {
      next(err);
    }
  });

  app.post('/identity/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = req.headers['x-user-role'] as string;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      if (role !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Permiso denegado. Se requiere rol ADMIN',
          },
        });
      }

      const invited = await inviteUser.execute({
        tenantId,
        email: req.body.email,
        displayName: req.body.displayName,
        password: req.body.password,
        role: req.body.role || 'STAFF',
      });

      res.status(201).json(invited);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/identity/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = req.headers['x-user-role'] as string;
      const userId = req.headers['x-user-id'] as string;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      if (role !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Permiso denegado. Se requiere rol ADMIN',
          },
        });
      }

      const updated = await manageTeam.updateUser({
        tenantId,
        currentUserId: userId,
        targetUserId: req.params.id,
        displayName: req.body.displayName,
        role: req.body.role,
      });

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.post('/identity/users/:id/disable', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = req.headers['x-user-role'] as string;
      const userId = req.headers['x-user-id'] as string;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      if (role !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Permiso denegado. Se requiere rol ADMIN',
          },
        });
      }

      const disabled = await manageTeam.setStatus({
        tenantId,
        currentUserId: userId,
        targetUserId: req.params.id,
        status: 'DISABLED',
      });

      res.status(200).json(disabled);
    } catch (err) {
      next(err);
    }
  });

  app.post('/identity/users/:id/enable', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = req.headers['x-user-role'] as string;
      const userId = req.headers['x-user-id'] as string;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      if (role !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Permiso denegado. Se requiere rol ADMIN',
          },
        });
      }

      const enabled = await manageTeam.setStatus({
        tenantId,
        currentUserId: userId,
        targetUserId: req.params.id,
        status: 'ACTIVE',
      });

      res.status(200).json(enabled);
    } catch (err) {
      next(err);
    }
  });

  app.post('/identity/users/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const role = req.headers['x-user-role'] as string;

      if (!tenantId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cabeceras de identidad requeridas',
          },
        });
      }

      if (role !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Permiso denegado. Se requiere rol ADMIN',
          },
        });
      }

      const result = await manageTeam.resetPassword({
        tenantId,
        targetUserId: req.params.id,
        newPassword: req.body.password,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Error middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = err.message || 'Error interno del servidor';

    if (err instanceof DomainError) {
      code = err.code;
      switch (err.code) {
        case 'VALIDATION_ERROR':
          status = 400;
          break;
        case 'INVALID_CREDENTIALS':
        case 'UNAUTHENTICATED':
          status = 401;
          break;
        case 'FORBIDDEN':
          status = 403;
          break;
        case 'NOT_FOUND':
          status = 404;
          break;
        case 'EMAIL_TAKEN':
        case 'SLUG_TAKEN':
        case 'CONFLICT':
          status = 409;
          break;
        default:
          status = 400;
          break;
      }
    }

    res.status(status).json({
      error: {
        code,
        message,
      },
    });
  });

  return app;
}
