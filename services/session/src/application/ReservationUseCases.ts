import {
  ReservationDTO,
  ReservationStatus,
  ReservationRepository,
  TableRepository,
  TableSessionRepository,
  TableSessionDTO,
  DomainError,
} from '@packages/shared-types';

export class CreateReservationUseCaseImpl {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly tableRepo: TableRepository
  ) {}

  async execute(input: {
    tenantId: string;
    tableId: string;
    customerName: string;
    phone: string;
    partySize: number;
    reservedFor: string;
    notes?: string;
    id?: string;
  }): Promise<ReservationDTO> {
    if (!input.tableId || typeof input.tableId !== 'string' || input.tableId.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El tableId es requerido');
    }

    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table) {
      throw new DomainError('TABLE_NOT_FOUND', `Mesa ${input.tableId} no encontrada`);
    }

    if (!input.customerName || typeof input.customerName !== 'string' || input.customerName.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El nombre del cliente es requerido');
    }

    if (!input.phone || typeof input.phone !== 'string' || input.phone.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El teléfono es requerido');
    }

    if (!input.partySize || !Number.isInteger(input.partySize) || input.partySize <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'El número de personas debe ser un entero positivo');
    }

    if (!input.reservedFor || typeof input.reservedFor !== 'string' || isNaN(new Date(input.reservedFor).getTime())) {
      throw new DomainError('VALIDATION_ERROR', 'Fecha de reserva inválida');
    }

    const id = input.id || `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const reservation: ReservationDTO = {
      id,
      tenantId: input.tenantId,
      tableId: input.tableId,
      customerName: input.customerName.trim(),
      phone: input.phone.trim(),
      partySize: input.partySize,
      reservedFor: new Date(input.reservedFor).toISOString(),
      status: 'active',
      notes: input.notes ? input.notes.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    return this.reservationRepo.save(input.tenantId, reservation);
  }
}

export class ListReservationsUseCaseImpl {
  constructor(private readonly reservationRepo: ReservationRepository) {}

  async execute(input: {
    tenantId: string;
    filter?: { tableId?: string; date?: string; status?: ReservationStatus };
  }): Promise<ReservationDTO[]> {
    return this.reservationRepo.listByTenant(input.tenantId, input.filter);
  }
}

export class CancelReservationUseCaseImpl {
  constructor(private readonly reservationRepo: ReservationRepository) {}

  async execute(input: { tenantId: string; reservationId: string }): Promise<ReservationDTO> {
    const reservation = await this.reservationRepo.findById(input.tenantId, input.reservationId);
    if (!reservation) {
      throw new DomainError('RESERVATION_NOT_FOUND', `Reserva ${input.reservationId} no encontrada`);
    }

    reservation.status = 'cancelled';
    return this.reservationRepo.save(input.tenantId, reservation);
  }
}

export class SeatReservationUseCaseImpl {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly sessionRepo: TableSessionRepository,
    private readonly ttlSeconds: number = 14400
  ) {}

  async execute(input: {
    tenantId: string;
    reservationId: string;
  }): Promise<{ reservation: ReservationDTO; session: TableSessionDTO }> {
    const reservation = await this.reservationRepo.findById(input.tenantId, input.reservationId);
    if (!reservation) {
      throw new DomainError('RESERVATION_NOT_FOUND', `Reserva ${input.reservationId} no encontrada`);
    }

    if (reservation.status === 'cancelled') {
      throw new DomainError('BAD_USER_INPUT', 'La reserva ya fue cancelada');
    }

    reservation.status = 'seated';
    const updatedReservation = await this.reservationRepo.save(input.tenantId, reservation);

    const session = await this.sessionRepo.getOrCreateActive!(
      input.tenantId,
      reservation.tableId,
      this.ttlSeconds
    );

    return { reservation: updatedReservation, session };
  }
}

export class UpdateReservationUseCaseImpl {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly tableRepo?: TableRepository
  ) {}

  async execute(input: {
    tenantId: string;
    reservationId: string;
    customerName?: string;
    phone?: string;
    partySize?: number;
    reservedFor?: string;
    notes?: string;
    tableId?: string;
  }): Promise<ReservationDTO> {
    const reservation = await this.reservationRepo.findById(input.tenantId, input.reservationId);
    if (!reservation) {
      throw new DomainError('RESERVATION_NOT_FOUND', `Reserva ${input.reservationId} no encontrada`);
    }

    if (input.customerName !== undefined) {
      if (typeof input.customerName !== 'string' || input.customerName.trim() === '') {
        throw new DomainError('VALIDATION_ERROR', 'El nombre del cliente es requerido');
      }
      reservation.customerName = input.customerName.trim();
    }

    if (input.phone !== undefined) {
      if (typeof input.phone !== 'string' || input.phone.trim() === '') {
        throw new DomainError('VALIDATION_ERROR', 'El teléfono es requerido');
      }
      reservation.phone = input.phone.trim();
    }

    if (input.partySize !== undefined) {
      if (!Number.isInteger(input.partySize) || input.partySize <= 0) {
        throw new DomainError('VALIDATION_ERROR', 'El número de personas debe ser un entero positivo');
      }
      reservation.partySize = input.partySize;
    }

    if (input.reservedFor !== undefined) {
      if (typeof input.reservedFor !== 'string' || isNaN(new Date(input.reservedFor).getTime())) {
        throw new DomainError('VALIDATION_ERROR', 'Fecha de reserva inválida');
      }
      reservation.reservedFor = new Date(input.reservedFor).toISOString();
    }

    if (input.tableId !== undefined) {
      if (typeof input.tableId !== 'string' || input.tableId.trim() === '') {
        throw new DomainError('VALIDATION_ERROR', 'El tableId es requerido');
      }
      if (this.tableRepo) {
        const table = await this.tableRepo.findById(input.tenantId, input.tableId);
        if (!table) {
          throw new DomainError('TABLE_NOT_FOUND', `Mesa ${input.tableId} no encontrada`);
        }
      }
      reservation.tableId = input.tableId.trim();
    }

    if (input.notes !== undefined) {
      reservation.notes = typeof input.notes === 'string' && input.notes.trim() !== '' ? input.notes.trim() : undefined;
    }

    return this.reservationRepo.save(input.tenantId, reservation);
  }
}
