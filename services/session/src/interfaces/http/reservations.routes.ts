import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffRole } from './middleware/requireStaffRole';
import {
  CreateReservationUseCaseImpl,
  ListReservationsUseCaseImpl,
  CancelReservationUseCaseImpl,
  SeatReservationUseCaseImpl,
} from '../../application/ReservationUseCases';
import {
  ReservationRepository,
  TableRepository,
  TableSessionRepository,
} from '@packages/shared-types';

export function createReservationsRouter(deps: {
  reservationRepo: ReservationRepository;
  tableRepo: TableRepository;
  sessionRepo: TableSessionRepository;
  createReservationUseCase?: CreateReservationUseCaseImpl;
  listReservationsUseCase?: ListReservationsUseCaseImpl;
  cancelReservationUseCase?: CancelReservationUseCaseImpl;
  seatReservationUseCase?: SeatReservationUseCaseImpl;
}): Router {
  const router = Router();
  const {
    reservationRepo,
    tableRepo,
    sessionRepo,
    createReservationUseCase = new CreateReservationUseCaseImpl(reservationRepo, tableRepo),
    listReservationsUseCase = new ListReservationsUseCaseImpl(reservationRepo),
    cancelReservationUseCase = new CancelReservationUseCaseImpl(reservationRepo),
    seatReservationUseCase = new SeatReservationUseCaseImpl(reservationRepo, sessionRepo),
  } = deps;

  // GET /reservations -> staff+ (supports filters by tableId or date)
  router.get(
    '/',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const tableId = req.query.tableId as string | undefined;
        const date = req.query.date as string | undefined;

        const reservations = await listReservationsUseCase.execute({
          tenantId,
          filter: { tableId, date },
        });
        res.status(200).json(reservations);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /reservations -> staff+
  router.post(
    '/',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const reservation = await createReservationUseCase.execute({
          tenantId,
          tableId: req.body.tableId,
          customerName: req.body.customerName,
          phone: req.body.phone,
          partySize: req.body.partySize,
          reservedFor: req.body.reservedFor,
          notes: req.body.notes,
          id: req.body.id,
        });
        res.status(201).json(reservation);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /reservations/:id/cancel -> staff+
  router.patch(
    '/:id/cancel',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const cancelled = await cancelReservationUseCase.execute({
          tenantId,
          reservationId: req.params.id,
        });
        res.status(200).json(cancelled);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /reservations/:id/seat -> staff+ ('Cliente Llegó': changes status to 'seated' and opens table session)
  router.post(
    '/:id/seat',
    requireStaffRole(['staff', 'manager', 'admin']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const result = await seatReservationUseCase.execute({
          tenantId,
          reservationId: req.params.id,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
