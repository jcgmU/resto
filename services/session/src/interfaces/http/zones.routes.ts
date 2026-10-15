import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffRole } from './middleware/requireStaffRole';
import {
  CreateZoneUseCaseImpl,
  UpdateZoneUseCaseImpl,
  ListZonesUseCaseImpl,
  DeleteZoneUseCaseImpl,
} from '../../application/ZoneUseCases';
import { ZoneRepository, TableRepository } from '@packages/shared-types';

export function createZonesRouter(deps: {
  zoneRepo: ZoneRepository;
  tableRepo: TableRepository;
  createZoneUseCase?: CreateZoneUseCaseImpl;
  updateZoneUseCase?: UpdateZoneUseCaseImpl;
  listZonesUseCase?: ListZonesUseCaseImpl;
  deleteZoneUseCase?: DeleteZoneUseCaseImpl;
}): Router {
  const router = Router();
  const {
    zoneRepo,
    tableRepo,
    createZoneUseCase = new CreateZoneUseCaseImpl(zoneRepo),
    updateZoneUseCase = new UpdateZoneUseCaseImpl(zoneRepo),
    listZonesUseCase = new ListZonesUseCaseImpl(zoneRepo),
    deleteZoneUseCase = new DeleteZoneUseCaseImpl(zoneRepo, tableRepo),
  } = deps;

  // GET /zones -> staff+
  router.get(
    '/',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const zones = await listZonesUseCase.execute({ tenantId });
        res.status(200).json(zones);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /zones -> admin/manager
  router.post(
    '/',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const zone = await createZoneUseCase.execute({
          tenantId,
          name: req.body.name,
          sortOrder: req.body.sortOrder,
          id: req.body.id,
        });
        res.status(201).json(zone);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /zones/:id -> admin/manager
  router.patch(
    '/:id',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const updated = await updateZoneUseCase.execute({
          tenantId,
          zoneId: req.params.id,
          name: req.body.name,
          sortOrder: req.body.sortOrder,
        });
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /zones/:id -> admin/manager (blocked with 409 if zone has assigned tables)
  router.delete(
    '/:id',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        await deleteZoneUseCase.execute({
          tenantId,
          zoneId: req.params.id,
        });
        res.status(200).json({ success: true, message: 'Zona eliminada' });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
