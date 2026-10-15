import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffRole } from './middleware/requireStaffRole';
import {
  CreateTableUseCaseImpl,
  GenerateTableQrUseCaseImpl,
  RotateTableQrKeyUseCaseImpl,
} from '../../application/TableUseCases';
import {
  TableRepository,
  TableSessionRepository,
  ZoneRepository,
  ReservationRepository,
  TableStatus,
} from '@packages/shared-types';

function isToday(isoDateString: string): boolean {
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const sameUtc =
      d.getUTCFullYear() === now.getUTCFullYear() &&
      d.getUTCMonth() === now.getUTCMonth() &&
      d.getUTCDate() === now.getUTCDate();
    const sameLocal =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return sameUtc || sameLocal;
  } catch {
    return false;
  }
}

export function createTablesRouter(deps: {
  tableRepo: TableRepository;
  createTableUseCase: CreateTableUseCaseImpl;
  generateTableQrUseCase: GenerateTableQrUseCaseImpl;
  rotateTableQrKeyUseCase: RotateTableQrKeyUseCaseImpl;
  sessionRepo?: TableSessionRepository;
  zoneRepo?: ZoneRepository;
  reservationRepo?: ReservationRepository;
}): Router {
  const router = Router();
  const {
    tableRepo,
    createTableUseCase,
    generateTableQrUseCase,
    rotateTableQrKeyUseCase,
    sessionRepo,
    zoneRepo,
    reservationRepo,
  } = deps;

  const VALID_TABLE_STATUSES: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED'];

  // POST /tables -> staff (admin/manager)
  router.post(
    '/',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const { label, zoneId, capacity, status } = req.body;

        if (zoneId && zoneRepo) {
          const zone = await zoneRepo.findById(tenantId, zoneId);
          if (!zone) {
            return res.status(400).json({
              error: { code: 'VALIDATION_ERROR', message: `Zona ${zoneId} no encontrada` },
            });
          }
        }

        if (capacity !== undefined) {
          if (!Number.isInteger(capacity) || capacity <= 0) {
            return res.status(400).json({
              error: { code: 'VALIDATION_ERROR', message: 'La capacidad debe ser un entero positivo' },
            });
          }
        }

        if (status !== undefined) {
          if (!VALID_TABLE_STATUSES.includes(status) && status !== 'active') {
            return res.status(400).json({
              error: { code: 'VALIDATION_ERROR', message: 'Estado de mesa inválido' },
            });
          }
        }

        const result = await createTableUseCase.execute({
          tenantId,
          label,
          zoneId,
          capacity,
          status,
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

        let todayReservedTableIds = new Set<string>();
        if (reservationRepo) {
          const reservations = await reservationRepo.listByTenant(tenantId, { status: 'active' });
          todayReservedTableIds = new Set(
            reservations.filter((r) => isToday(r.reservedFor)).map((r) => r.tableId)
          );
        }

        const enriched = list.map((table) => {
          let status = table.status;
          if (status !== 'DISABLED' && status !== 'inactive') {
            if (todayReservedTableIds.has(table.tableId)) {
              status = 'RESERVED';
            }
          }
          return {
            ...table,
            status,
            capacity: table.capacity ?? 4,
          };
        });

        res.status(200).json(enriched);
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
        const table = await tableRepo.findById(tenantId, req.params.tableId);
        if (!table) {
          return res.status(404).json({ error: { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' } });
        }

        if (req.body.status !== undefined) {
          if (!VALID_TABLE_STATUSES.includes(req.body.status)) {
            return res.status(400).json({
              error: { code: 'VALIDATION_ERROR', message: 'Estado de mesa inválido' },
            });
          }
        }

        if (req.body.capacity !== undefined) {
          if (!Number.isInteger(req.body.capacity) || req.body.capacity <= 0) {
            return res.status(400).json({
              error: { code: 'VALIDATION_ERROR', message: 'La capacidad debe ser un entero positivo' },
            });
          }
        }

        if (req.body.zoneId !== undefined && req.body.zoneId !== null && req.body.zoneId !== '') {
          if (zoneRepo) {
            const zone = await zoneRepo.findById(tenantId, req.body.zoneId);
            if (!zone) {
              return res.status(400).json({
                error: { code: 'VALIDATION_ERROR', message: `Zona ${req.body.zoneId} no encontrada` },
              });
            }
          }
        }

        if (req.body.label !== undefined) {
          if (typeof req.body.label !== 'string' || req.body.label.trim() === '') {
            return res.status(400).json({
              error: { code: 'VALIDATION_ERROR', message: 'El label de la mesa es requerido' },
            });
          }
        }

        const updated = await tableRepo.save(tenantId, {
          ...table,
          ...(req.body.label ? { label: req.body.label.trim() } : {}),
          ...(req.body.status !== undefined ? { status: req.body.status } : {}),
          ...(req.body.zoneId !== undefined ? { zoneId: req.body.zoneId } : {}),
          ...(req.body.capacity !== undefined ? { capacity: req.body.capacity } : {}),
        });
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /tables/:tableId -> admin/manager (blocked with 409 if active session or active reservation)
  router.delete(
    '/:tableId',
    requireStaffRole(['admin', 'manager']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const table = await tableRepo.findById(tenantId, req.params.tableId);
        if (!table) {
          return res.status(404).json({ error: { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' } });
        }

        if (sessionRepo) {
          const activeSession = await sessionRepo.findActiveByTable(tenantId, req.params.tableId);
          if (activeSession && (activeSession.status === 'active' || activeSession.status === 'billRequested')) {
            return res.status(409).json({
              error: { code: 'TABLE_HAS_ACTIVE_SESSION', message: 'No se puede eliminar una mesa con sesión activa' },
            });
          }
        }

        if (reservationRepo) {
          const reservations = await reservationRepo.listByTable(tenantId, req.params.tableId);
          const hasActiveReservation = reservations.some((r) => r.status === 'active');
          if (hasActiveReservation) {
            return res.status(409).json({
              error: { code: 'TABLE_HAS_ACTIVE_RESERVATION', message: 'No se puede eliminar una mesa con reservas activas' },
            });
          }
        }

        await tableRepo.delete(tenantId, req.params.tableId);
        res.status(200).json({ success: true, message: 'Mesa eliminada' });
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
