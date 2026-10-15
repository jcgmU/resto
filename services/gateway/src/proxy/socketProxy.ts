import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export function attachSocketGateway(server: http.Server) {
  try {
    const corsModule = require('cors');
    if (typeof corsModule !== 'function' && typeof corsModule.default === 'function') {
      const corsFn = corsModule.default;
      (corsFn as any).default = corsFn;
      if (require.cache[require.resolve('cors')]) {
        require.cache[require.resolve('cors')]!.exports = corsFn;
      }
    }
  } catch {}

  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  const ordersNs = io.of('/orders');

  ordersNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('UNAUTHORIZED'));
    }
    try {
      jwt.verify(token, config.jwtSecret);
      next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  ordersNs.on('connection', (clientSocket) => {
    const orderingWsPort = process.env.ORDERING_WS_PORT;
    const targetUrl = orderingWsPort
      ? `http://localhost:${orderingWsPort}/orders`
      : `${config.services.ordering}/orders`;

    const upstream = ioc(targetUrl, {
      auth: { token: clientSocket.handshake.auth?.token },
      transports: ['websocket'],
      reconnection: false,
    });

    upstream.on('ready', (data) => {
      clientSocket.emit('ready', data);
    });

    upstream.onAny((event, ...args) => {
      if (event !== 'ready') {
        clientSocket.emit(event, ...args);
      }
    });

    clientSocket.onAny((event, ...args) => {
      upstream.emit(event, ...args);
    });

    clientSocket.on('disconnect', () => {
      upstream.close();
    });
  });

  return io;
}
