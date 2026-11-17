import fs from 'fs';
import path from 'path';
import {
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
} from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';
import { InviteUserUseCaseImpl } from '../../src/application/InviteUser';
import { ManageTeamUseCaseImpl } from '../../src/application/ManageTeam';

function user(id: string, role = 'WAITER') {
  return {
    id,
    tenantId: 't1',
    email: `${id}@t1.com`,
    displayName: id,
    role,
    status: 'ACTIVE',
    passwordHash: 'hashed_x',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function setup() {
  const repo = new InMemoryUserRepository();
  repo.users = [user('admin-1', 'ADMIN'), user('w-1')];
  const uc = new ManageTeamUseCaseImpl(repo, new InMemoryRefreshTokenRepository(), new FakePasswordHasher());
  return { repo, uc };
}

const update = (uc: ManageTeamUseCaseImpl, avatarUrl: string | null | undefined) =>
  uc.updateUser({ tenantId: 't1', currentUserId: 'admin-1', targetUserId: 'w-1', avatarUrl });

describe('Foto de perfil (avatarUrl)', () => {
  test('el admin puede asignar una foto subida con /v1/uploads', async () => {
    const { uc } = setup();
    const updated = await update(uc, '/v1/uploads/foto-carlos.jpg');
    expect(updated.avatarUrl).toBe('/v1/uploads/foto-carlos.jpg');
  });

  test('acepta una URL https y permite quitarla con null', async () => {
    const { uc } = setup();
    expect((await update(uc, 'https://cdn.ejemplo.com/a.png')).avatarUrl).toBe('https://cdn.ejemplo.com/a.png');
    expect((await update(uc, null)).avatarUrl).toBeNull();
  });

  test.each(['javascript:alert(1)', 'data:text/html;base64,AAAA', 'foto.jpg', '  ', '/otra/ruta.png'])(
    'rechaza %p con VALIDATION_ERROR',
    async (value) => {
      const { uc } = setup();
      await expect(update(uc, value)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  );

  test('editar solo el nombre no borra la foto existente', async () => {
    const { uc } = setup();
    await update(uc, '/v1/uploads/foto.jpg');
    const renamed = await uc.updateUser({ tenantId: 't1', currentUserId: 'admin-1', targetUserId: 'w-1', displayName: 'Nuevo' });
    expect(renamed.avatarUrl).toBe('/v1/uploads/foto.jpg');
  });

  test('InviteUser guarda avatarUrl opcional', async () => {
    const uc = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
    const created = await uc.execute({
      tenantId: 't1',
      email: 'nuevo@t1.com',
      displayName: 'Nuevo',
      password: 'password123',
      role: 'WAITER',
      avatarUrl: '/v1/uploads/n.jpg',
    } as any);
    expect((created as any).avatarUrl).toBe('/v1/uploads/n.jpg');
  });

  test('migración nueva añade la columna avatarUrl sin tocar datos', () => {
    const dir = path.resolve(__dirname, '../../prisma/migrations');
    const sqls = fs
      .readdirSync(dir)
      .filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
      .map((d) => fs.readFileSync(path.join(dir, d, 'migration.sql'), 'utf8'));
    const add = sqls.find((s) => /ALTER TABLE "User" ADD COLUMN\s+"avatarUrl" TEXT/i.test(s));
    expect(add).toBeDefined();
    expect(add).not.toMatch(/DROP|DELETE|UPDATE/i);
  });
});
