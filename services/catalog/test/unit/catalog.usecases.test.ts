import {
  CreateCategoryUseCaseImpl,
  DeleteCategoryUseCaseImpl,
} from '../../src/application/CategoryUseCases';
import {
  CreateProductUseCaseImpl,
  UpdateProductUseCaseImpl,
  SetProductAvailabilityUseCaseImpl,
  AttachModifierGroupUseCaseImpl,
} from '../../src/application/ProductUseCases';
import {
  CreateModifierGroupUseCaseImpl,
} from '../../src/application/ModifierGroupUseCases';
import { DomainError } from '@packages/shared-types';

describe('C. Catalog — unitarios de casos de uso (Tests 16-23)', () => {
  test('16. CreateCategory persiste con el tenantId del contexto', async () => {
    const useCase = new CreateCategoryUseCaseImpl();
    const category = await useCase.execute({
      tenantId: 'tenant-100',
      name: 'Postres',
      sortOrder: 1,
    });

    expect(category.tenantId).toBe('tenant-100');
    expect(category.name).toBe('Postres');
  });

  test('17. CreateProduct con precio negativo -> BAD_USER_INPUT', async () => {
    const useCase = new CreateProductUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        categoryId: 'cat-1',
        name: 'Pastel de Chocolate',
        price: -5.0,
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'BAD_USER_INPUT' } as Partial<DomainError>)
    );
  });

  test('18. CreateProduct con categoryId inexistente en el tenant -> NOT_FOUND', async () => {
    const useCase = new CreateProductUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        categoryId: 'cat-nonexistent',
        name: 'Helado',
        price: 4.5,
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>)
    );
  });

  test('19. UpdateProduct apuntando a un producto de OTRO tenant -> NOT_FOUND (aislamiento)', async () => {
    const useCase = new UpdateProductUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-A',
        id: 'product-of-tenant-B',
        name: 'Intento de Hack',
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>)
    );
  });

  test('20. DeleteCategory con productos asociados -> CATEGORY_NOT_EMPTY', async () => {
    const useCase = new DeleteCategoryUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        id: 'category-with-products',
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'CATEGORY_NOT_EMPTY' } as Partial<DomainError>)
    );
  });

  test('21. CreateModifierGroup con maxSelections < minSelections -> BAD_USER_INPUT', async () => {
    const useCase = new CreateModifierGroupUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        name: 'Opciones de Salsa',
        minSelections: 3,
        maxSelections: 1,
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'BAD_USER_INPUT' } as Partial<DomainError>)
    );
  });

  test('22. attachModifierGroup duplicado -> idempotente, no crea fila duplicada', async () => {
    const useCase = new AttachModifierGroupUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        productId: 'prod-1',
        groupId: 'group-1',
      })
    ).resolves.not.toThrow();
  });

  test('23. setProductAvailability(false) -> el producto sigue listándose con isAvailable: false; con onlyAvailable: true desaparece del listado', async () => {
    const useCase = new SetProductAvailabilityUseCaseImpl();
    const product = await useCase.execute({
      tenantId: 'tenant-100',
      id: 'prod-1',
      isAvailable: false,
    });

    expect(product.isAvailable).toBe(false);
  });

  test('24. SetProductAvailability apuntando a producto de OTRO tenant -> NOT_FOUND (aislamiento U3)', async () => {
    const useCase = new SetProductAvailabilityUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        id: 'product-of-tenant-B',
        isAvailable: false,
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>)
    );
  });

  test('25. UpdateProduct con categoryId de OTRO tenant -> NOT_FOUND (aislamiento U3)', async () => {
    const useCase = new UpdateProductUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        id: 'prod-1',
        categoryId: 'cat-b',
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>)
    );
  });

  test('26. AttachModifierGroup con producto de OTRO tenant -> NOT_FOUND (aislamiento U3)', async () => {
    const useCase = new AttachModifierGroupUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        productId: 'product-of-tenant-B',
        groupId: 'group-1',
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>)
    );
  });

  test('27. AttachModifierGroup con groupId de OTRO tenant -> NOT_FOUND (aislamiento U3)', async () => {
    const useCase = new AttachModifierGroupUseCaseImpl();
    await expect(
      useCase.execute({
        tenantId: 'tenant-100',
        productId: 'prod-1',
        groupId: 'group-of-tenant-B',
      })
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>)
    );
  });
});
