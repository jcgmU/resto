import { Router } from 'express';
import { ServiceCallUseCases } from '../../application/ServiceCallUseCases';
import { ServiceCallStatus } from '@packages/shared-types';

export function createServiceCallsRouter(serviceCallUseCases: ServiceCallUseCases): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { tenantId, sessionId } = req.auth!;

      if (!sessionId) {
        return res.status(401).json({
          error: { code: 'SESSION_REQUIRED', message: 'Sesión requerida para llamar al mesero' },
        });
      }

      const { tableId, note, type } = req.body || {};

      const call = await serviceCallUseCases.createServiceCall.execute({
        tenantId,
        sessionId,
        tableId,
        type,
        note,
      });

      res.status(201).json(call);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { tenantId, role } = req.auth!;
      const isStaff = role && ['staff', 'manager', 'admin'].includes(role.toLowerCase());

      if (!isStaff) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo personal autorizado puede listar llamadas' },
        });
      }

      const status = (req.query.status as ServiceCallStatus) || 'pending';
      const calls = await serviceCallUseCases.listServiceCalls.execute({
        tenantId,
        filter: { status },
      });

      res.json(calls);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/resolve', async (req, res, next) => {
    try {
      const { tenantId, role } = req.auth!;
      const isStaff = role && ['staff', 'manager', 'admin'].includes(role.toLowerCase());

      if (!isStaff) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo personal autorizado puede resolver llamadas' },
        });
      }

      const { id } = req.params;
      const resolved = await serviceCallUseCases.resolveServiceCall.execute({
        tenantId,
        callId: id,
      });

      res.json(resolved);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
