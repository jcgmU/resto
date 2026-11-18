import { disconnectTestInfra } from './contract/contract-helper';
import { closeDefaultAppConnections } from '../src/app';

export default async function globalTeardown(): Promise<void> {
  await disconnectTestInfra().catch(() => {});
  await closeDefaultAppConnections().catch(() => {});
}
