import {
  ensureContractEnv,
  getTestRedis,
  disconnectTestRedis,
} from './contract-helper';

describe('Session Contract Infra (Redis db2 Real)', () => {
  beforeAll(async () => {
    await ensureContractEnv();
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  it('debe responder PONG al hacer PING a Redis db2', async () => {
    const redis = getTestRedis();
    const result = await redis.ping();
    expect(result).toBe('PONG');
  });
});
