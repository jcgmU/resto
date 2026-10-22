import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffRole } from './middleware/requireStaffRole';
import {
  OpenTableSessionUseCaseImpl,
  StaffOpenSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
  GetTableSessionUseCaseImpl,
  ListTableSessionsUseCaseImpl,
  RequestBillSessionUseCaseImpl,
  ReopenBillSessionUseCaseImpl,
  MoveTableSessionUseCaseImpl,
} from '../../application/SessionUseCases';

export function createSessionsRouter(deps: {
  openTableSessionUseCase: OpenTableSessionUseCaseImpl;
  staffOpenSessionUseCase?: StaffOpenSessionUseCaseImpl;
  closeTableSessionUseCase: CloseTableSessionUseCaseImpl;
  getTableSessionUseCase: GetTableSessionUseCaseImpl;
  listTableSessionsUseCase: ListTableSessionsUseCaseImpl;
  requestBillSessionUseCase: RequestBillSessionUseCaseImpl;
  reopenBillSessionUseCase: ReopenBillSessionUseCaseImpl;
  moveTableSessionUseCase?: MoveTableSessionUseCaseImpl;
}): Router {
  const router = Router();
  const {
    openTableSessionUseCase,
    staffOpenSessionUseCase,
    closeTableSessionUseCase,
    getTableSessionUseCase,
    listTableSessionsUseCase,
    requestBillSessionUseCase,
    reopenBillSessionUseCase,
    moveTableSessionUseCase,
  } = deps;

  // POST /sessions/staff-open -> protegido para staff (ADMIN, MANAGER, STAFF, WAITER)
  router.post(
    '/staff-open',
    requireStaffRole(['admin', 'manager', 'staff', 'waiter']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = (req.headers['x-tenant-id'] as string) || req.body?.tenantId;
        const { tableId } = req.body || {};
        if (!staffOpenSessionUseCase) {
          throw new Error('staffOpenSessionUseCase no configurado');
        }
        const result = await staffOpenSessionUseCase.execute({
          tenantId,
          tableId,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /sessions/open -> PÚBLICA
  router.post('/open', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, tableId, qrKey } = req.body;
      const result = await openTableSessionUseCase.execute({
        tenantId,
        tableId,
        qrKey,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /sessions/:id -> staff o guest con x-session-id coincidente
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const userRole = (req.headers['x-user-role'] as string || '').toLowerCase();
      const guestSessionId = req.headers['x-session-id'] as string;

      const isStaff = ['staff', 'manager', 'admin', 'waiter', 'cashier'].includes(userRole);

      if (!isStaff) {
        if (!guestSessionId || guestSessionId !== req.params.id) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'No autorizado para acceder a esta sesión',
            },
          });
        }
      }

      const role = isStaff ? userRole : 'guest';
      const session = await getTableSessionUseCase.execute({
        tenantId,
        sessionId: req.params.id,
        requester: { role, sessionId: guestSessionId },
      });

      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  });

  // POST /sessions/:id/bill-request -> guest o staff
  router.post('/:id/bill-request', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req.headers['x-tenant-id'] as string) || req.body?.tenantId;
      const userRole = ((req.headers['x-user-role'] as string) || '').toLowerCase();
      const guestSessionId = req.headers['x-session-id'] as string;

      const isStaff = ['staff', 'manager', 'admin', 'waiter', 'cashier'].includes(userRole);

      if (!isStaff) {
        if (!guestSessionId || guestSessionId !== req.params.id) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'No autorizado para solicitar la cuenta de esta sesión',
            },
          });
        }
      }

      const result = await requestBillSessionUseCase.execute({
        tenantId,
        sessionId: req.params.id,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /sessions/:id/bill-reopen -> staff
  router.post(
    '/:id/bill-reopen',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = (req.headers['x-tenant-id'] as string) || req.body?.tenantId;
        const result = await reopenBillSessionUseCase.execute({
          tenantId,
          sessionId: req.params.id,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH y POST /sessions/:id/close -> staff
  const handleClose = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req.headers['x-tenant-id'] as string) || req.body?.tenantId;
      const result = await closeTableSessionUseCase.execute({
        tenantId,
        sessionId: req.params.id,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  router.patch('/:id/close', requireStaffRole(['staff', 'manager', 'admin', 'waiter', 'cashier']), handleClose);
  router.post('/:id/close', requireStaffRole(['staff', 'manager', 'admin', 'waiter', 'cashier']), handleClose);

  // POST /sessions/:id/move y POST /sessions/move -> staff (ADMIN, MANAGER, STAFF, WAITER, CASHIER)
  const handleMove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req.headers['x-tenant-id'] as string) || req.body?.tenantId;
      const sessionId = req.params.id || req.body?.sessionId;
      const targetTableId = req.body?.targetTableId || req.body?.toTableId || req.body?.tableId;

      if (!moveTableSessionUseCase) {
        throw new Error('moveTableSessionUseCase no configurado');
      }

      const result = await moveTableSessionUseCase.execute({
        tenantId,
        sessionId,
        targetTableId,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  router.post('/:id/move', requireStaffRole(['staff', 'manager', 'admin', 'waiter', 'cashier']), handleMove);
  router.post('/move', requireStaffRole(['staff', 'manager', 'admin', 'waiter', 'cashier']), handleMove);

  // GET /sessions -> staff
  router.get(
    '/',
    requireStaffRole(['staff', 'manager', 'admin', 'waiter', 'cashier']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const status = req.query.status as 'active' | 'billRequested' | 'closed' | undefined;
        const tableId = req.query.tableId as string | undefined;

        const list = await listTableSessionsUseCase.execute({
          tenantId,
          filter: { status, tableId },
        });
        res.status(200).json(list);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
