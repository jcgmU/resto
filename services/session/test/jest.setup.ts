import { disconnectTestRedis } from './contract/contract-helper';
import { closeDefaultSessionAppConnections } from '../src/app';

afterAll(async () => {
  await disconnectTestRedis().catch(() => {});
  await closeDefaultSessionAppConnections().catch(() => {});
});
