import fs from 'fs';
import path from 'path';
import {
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
} from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';
import { InviteUserUseCaseImpl } from '../../src/application/InviteUser';
import { ManageTeamUseCaseImpl } from '../../src/application/ManageTeam';
import { ChangePasswordUseCaseImpl } from '../../src/application/ChangePassword';

const NEW_ROLES = ['MANAGER', 'WAITER', 'CASHIER', 'MONITOR'] as const;

function baseUser(id: string, role: string) {
  return {
    id,
    tenantId: 't1',
    email: `${id}@t1.com`,
    displayName: id,
    role,
    status: 'ACTIVE',
    passwordHash: 'hashed_clave12345',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

describe('Modelo de 5 roles (ADMIN, MANAGER, WAITER, CASHIER, MONITOR)', () => {
  test('InviteUser rechaza STAFF con VALIDATION_ERROR', async () => {
    const uc = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
    await expect(
      uc.execute({ tenantId: 't1', email: 'a@t1.com', displayName: 'A', password: 'password123', role: 'STAFF' as any })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test.each(NEW_ROLES)('InviteUser acepta %s', async (role) => {
    const uc = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
    const user = await uc.execute({
      tenantId: 't1',
      email: `${role}@t1.com`,
      displayName: role,
      password: 'password123',
      role: role as any,
      monitorKind: role === 'MONITOR' ? 'kitchen' : undefined,
    });
    expect(user.role).toBe(role);
  });

  test('ManageTeam.updateUser rechaza STAFF y acepta WAITER, CASHIER y MONITOR', async () => {
    const repo = new InMemoryUserRepository();
    repo.users = [baseUser('admin-1', 'ADMIN'), baseUser('u-1', 'WAITER')];
    const uc = new ManageTeamUseCaseImpl(repo, new InMemoryRefreshTokenRepository(), new FakePasswordHasher());
    const call = (role: string) =>
      uc.updateUser({ tenantId: 't1', currentUserId: 'admin-1', targetUserId: 'u-1', role: role as any });

    await expect(call('STAFF')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    for (const role of ['MANAGER', 'WAITER', 'CASHIER', 'MONITOR']) {
      await expect(call(role)).resolves.toMatchObject({ role });
    }
  });

  test.each(['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'MONITOR'])('change-password funciona para %s', async (role) => {
    const repo = new InMemoryUserRepository();
    repo.users = [baseUser('u-1', role)];
    const uc = new ChangePasswordUseCaseImpl(repo, new InMemoryRefreshTokenRepository(), new FakePasswordHasher());
    await expect(
      uc.execute({ userId: 'u-1', currentPassword: 'clave12345', newPassword: 'nuevaclave99' })
    ).resolves.toBeUndefined();
  });

  test('existe una migración que convierte STAFF en WAITER sin borrar el valor del enum', () => {
    const dir = path.resolve(__dirname, '../../prisma/migrations');
    const sqls = fs
      .readdirSync(dir)
      .filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
      .map((d) => fs.readFileSync(path.join(dir, d, 'migration.sql'), 'utf8'));
    const convert = sqls.find((s) => /UPDATE\s+"User"\s+SET\s+"?role"?\s*=\s*'WAITER'\s+WHERE\s+"?role"?\s*=\s*'STAFF'/i.test(s));
    expect(convert).toBeDefined();
    expect(convert).not.toMatch(/DROP\s+TYPE|ALTER\s+TYPE\s+"Role"\s+RENAME|DROP\s+VALUE/i);
  });
});
