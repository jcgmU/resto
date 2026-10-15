import { ProductDTO, ProductRepository, CategoryRepository, DomainError } from '@packages/shared-types';
import {
  InMemoryProductRepository,
  InMemoryCategoryRepository,
} from '../infrastructure/fakes/InMemoryCatalogAdapters';

export class CreateProductUseCaseImpl {
  constructor(
    private readonly productRepo: ProductRepository = new InMemoryProductRepository(),
    private readonly categoryRepo: CategoryRepository = new InMemoryCategoryRepository()
  ) {}

  async execute(input: {
    tenantId: string;
    categoryId: string;
    name: string;
    price: number;
    description?: string;
    imageUrl?: string;
    sortOrder?: number;
    prepTimeMinutes?: number | null;
  }): Promise<ProductDTO> {
    if (input.price < 0) {
      throw new DomainError('BAD_USER_INPUT', 'El precio no puede ser negativo');
    }

    const category = await this.categoryRepo.findById(input.tenantId, input.categoryId);
    if (!category) {
      throw new DomainError('NOT_FOUND', `Categoría ${input.categoryId} no encontrada`);
    }

    const product: ProductDTO = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: input.tenantId,
      categoryId: input.categoryId,
      name: input.name,
      price: input.price,
      description: input.description,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder ?? 0,
      prepTimeMinutes: input.prepTimeMinutes,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.productRepo.save(input.tenantId, product);
  }
}

export class UpdateProductUseCaseImpl {
  constructor(private readonly productRepo: ProductRepository = new InMemoryProductRepository()) {}

  async execute(input: {
    tenantId: string;
    id: string;
    name?: string;
    price?: number;
    description?: string;
    imageUrl?: string;
    categoryId?: string;
    sortOrder?: number;
    prepTimeMinutes?: number | null;
  }): Promise<ProductDTO> {
    const existing = await this.productRepo.findById(input.tenantId, input.id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Producto ${input.id} no encontrado en este restaurante`);
    }

    if (input.price !== undefined && input.price < 0) {
      throw new DomainError('BAD_USER_INPUT', 'El precio no puede ser negativo');
    }

    const updated: ProductDTO = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.prepTimeMinutes !== undefined ? { prepTimeMinutes: input.prepTimeMinutes } : {}),
      updatedAt: new Date(),
    };

    return this.productRepo.save(input.tenantId, updated);
  }
}

export class SetProductAvailabilityUseCaseImpl {
  constructor(private readonly productRepo: ProductRepository = new InMemoryProductRepository()) {}

  async execute(input: { tenantId: string; id: string; isAvailable: boolean }): Promise<ProductDTO> {
    return this.productRepo.setAvailability(input.tenantId, input.id, input.isAvailable);
  }
}

export class AttachModifierGroupUseCaseImpl {
  constructor(private readonly productRepo: ProductRepository = new InMemoryProductRepository()) {}

  async execute(input: { tenantId: string; productId: string; groupId: string }): Promise<void> {
    await this.productRepo.attachModifierGroup(input.tenantId, input.productId, input.groupId);
  }
}
