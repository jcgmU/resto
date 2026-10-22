import { Server as HttpServer } from 'http';
import { Server as SocketIoServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { RealtimeEmitter } from '@packages/shared-types';

interface DecodedToken {
  sub?: string;
  tenantId?: string;
  role?: string;
  sessionId?: string;
}

export class SocketIoRealtimeEmitter implements RealtimeEmitter {
  public io: SocketIoServer;
  private ordersNamespace: ReturnType<SocketIoServer['of']>;

  constructor(server: HttpServer, jwtSecret = process.env.JWT_SECRET || 'supersecret_change_in_production') {
    this.io = new SocketIoServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH'],
      },
    });

    this.ordersNamespace = this.io.of('/orders');

    this.ordersNamespace.use((socket: Socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: token missing'));
      }

      try {
        const decoded = jwt.verify(token, jwtSecret) as DecodedToken;
        socket.data.user = decoded;

        const role = (decoded.role || '').toLowerCase();
        const tenantId = decoded.tenantId;
        const sessionId = decoded.sessionId;

        const isStaff = ['staff', 'manager', 'admin', 'waiter', 'monitor', 'cashier'].includes(role);

        if (isStaff) {
          if (tenantId) {
            socket.join(`tenant:${tenantId}`);
          }
        } else if (role === 'guest') {
          if (sessionId) {
            socket.join(`session:${sessionId}`);
          }
        }

        next();
      } catch (err) {
        next(new Error('Authentication error: invalid token'));
      }
    });
  }

  emitToTenant(tenantId: string, event: string, payload: unknown): void {
    this.ordersNamespace.to(`tenant:${tenantId}`).emit(event, payload);
  }

  emitToSession(sessionId: string, event: string, payload: unknown): void {
    this.ordersNamespace.to(`session:${sessionId}`).emit(event, payload);
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => resolve());
    });
  }
}
