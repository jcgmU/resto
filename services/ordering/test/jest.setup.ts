import { disconnectTestInfra } from './contract/contract-helper';
import { closeDefaultAppConnections } from '../src/app';

afterAll(async () => {
  await disconnectTestInfra().catch(() => {});
  await closeDefaultAppConnections().catch(() => {});
});
