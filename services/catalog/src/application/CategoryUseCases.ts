import { CategoryDTO, CategoryRepository, DomainError } from '@packages/shared-types';
import { InMemoryCategoryRepository } from '../infrastructure/fakes/InMemoryCatalogAdapters';

export class CreateCategoryUseCaseImpl {
  constructor(private readonly categoryRepo: CategoryRepository = new InMemoryCategoryRepository()) {}

  async execute(input: { tenantId: string; name: string; sortOrder?: number; destination?: 'kitchen' | 'bar' }): Promise<CategoryDTO> {
    const category: CategoryDTO = {
      id: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: input.tenantId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
      destination: input.destination || 'kitchen',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.categoryRepo.save(input.tenantId, category);
  }
}

export class DeleteCategoryUseCaseImpl {
  constructor(private readonly categoryRepo: CategoryRepository = new InMemoryCategoryRepository()) {}

  async execute(input: { tenantId: string; id: string }): Promise<void> {
    const hasProducts = await this.categoryRepo.hasProducts(input.tenantId, input.id);
    if (hasProducts) {
      throw new DomainError('CATEGORY_NOT_EMPTY', 'No se puede eliminar una categoría con productos asociados');
    }
    await this.categoryRepo.delete(input.tenantId, input.id);
  }
}
