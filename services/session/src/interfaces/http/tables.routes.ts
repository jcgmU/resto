import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffRole } from './middleware/requireStaffRole';
import {
  CreateTableUseCaseImpl,
  CreateTablesBatchUseCaseImpl,
  UpdateTablesBatchUseCaseImpl,
  UpdateSingleTableUseCaseImpl,
  DeleteTablesBatchUseCaseImpl,
  GenerateTableQrUseCaseImpl,
  RotateTableQrKeyUseCaseImpl,
} from '../../application/TableUseCases';
import { TableRepository } from '@packages/shared-types';

export function createTablesRouter(deps: {
  tableRepo: TableRepository;
  createTableUseCase: CreateTableUseCaseImpl;
  createTablesBatchUseCase?: CreateTablesBatchUseCaseImpl;
  updateTablesBatchUseCase?: UpdateTablesBatchUseCaseImpl;
  updateSingleTableUseCase?: UpdateSingleTableUseCaseImpl;
  deleteTablesBatchUseCase?: DeleteTablesBatchUseCaseImpl;
  generateTableQrUseCase: GenerateTableQrUseCaseImpl;
  rotateTableQrKeyUseCase: RotateTableQrKeyUseCaseImpl;
}): Router {
  const router = Router();
  const {
    tableRepo,
    createTableUseCase,
    generateTableQrUseCase,
    rotateTableQrKeyUseCase,
  } = deps;

  const createTablesBatchUseCase =
    deps.createTablesBatchUseCase ?? new CreateTablesBatchUseCaseImpl(tableRepo);
  const updateTablesBatchUseCase =
    deps.updateTablesBatchUseCase ?? new UpdateTablesBatchUseCaseImpl(tableRepo);
  const updateSingleTableUseCase =
    deps.updateSingleTableUseCase ?? new UpdateSingleTableUseCaseImpl(tableRepo);
  const deleteTablesBatchUseCase =
    deps.deleteTablesBatchUseCase ?? new DeleteTablesBatchUseCaseImpl(tableRepo);

  // POST /tables/batch/delete -> admin/manager (declarada ANTES de /:tableId)
  router.post(
    '/batch/delete',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const result = await deleteTablesBatchUseCase.execute({
          tenantId,
          body: req.body,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /tables/batch -> admin/manager (declarada ANTES de /:tableId)
  router.post(
    '/batch',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const result = await createTablesBatchUseCase.execute({
          tenantId,
          body: req.body,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /tables/batch -> admin/manager (declarada ANTES de /:tableId)
  router.patch(
    '/batch',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const result = await updateTablesBatchUseCase.execute({
          tenantId,
          body: req.body,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /tables -> staff (admin/manager)
  router.post(
    '/',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const result = await createTableUseCase.execute({
          tenantId,
          label: req.body?.label,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /tables -> staff
  router.get(
    '/',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const list = await tableRepo.listByTenant(tenantId);
        res.status(200).json(list);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /tables/:tableId -> admin/manager
  router.patch(
    '/:tableId',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const updated = await updateSingleTableUseCase.execute({
          tenantId,
          tableId: req.params.tableId,
          body: req.body,
        });
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /tables/:tableId/qr -> staff
  router.get(
    '/:tableId/qr',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const qr = await generateTableQrUseCase.execute({
          tenantId,
          tableId: req.params.tableId,
        });
        res.status(200).json(qr);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /tables/:tableId/qr/rotate -> admin/manager
  router.post(
    '/:tableId/qr/rotate',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const qr = await rotateTableQrKeyUseCase.execute({
          tenantId,
          tableId: req.params.tableId,
        });
        res.status(200).json(qr);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
