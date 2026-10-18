import http from 'http';
import { createOrderingApp } from './app';
import { config } from './config';
import { SocketIoRealtimeEmitter } from './infrastructure/realtime/SocketIoRealtimeEmitter';
import { RedisEventSubscriber } from './infrastructure/events/RedisEventSubscriber';
import { wireRealtimeEvents } from './infrastructure/realtime/realtimeWiring';

const app = createOrderingApp();
export * from './application/CartUseCases';
export * from './application/OrderUseCases';
export * from './app';

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.ORDERING_PORT || process.env.PORT || 4004;
  const server = http.createServer(app);
  const emitter = new SocketIoRealtimeEmitter(server, config.jwtSecret);
  const subscriber = new RedisEventSubscriber(config.redisUrl);

  wireRealtimeEvents(subscriber, emitter);

  subscriber.start().then(() => {
    server.listen(PORT, () => {
      console.log(`Ordering Service with realtime running on port ${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to start Ordering realtime subscriber:', err);
    process.exit(1);
  });
}
