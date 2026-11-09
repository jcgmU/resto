import { ProductDTO, ProductRepository, DomainError } from '@packages/shared-types';

export class InMemoryProductRepository implements ProductRepository {
  public products: ProductDTO[] = [
    {
      id: 'prod-1',
      tenantId: 'tenant-100',
      categoryId: 'cat-1',
      name: 'Hamburguesa Clásica',
      price: 12.0,
      isAvailable: true,
      sortOrder: 0,
      modifierGroups: [
        {
          id: 'group-1',
          tenantId: 'tenant-100',
          name: 'Extras',
          minSelections: 0,
          maxSelections: 2,
          isRequired: false,
          options: [
            { id: 'opt-1', groupId: 'group-1', name: 'Queso Extra', priceDelta: 1.5, isDefault: false },
          ],
        },
      ],
    },
    {
      id: 'product-of-tenant-B',
      tenantId: 'tenant-B',
      categoryId: 'cat-b',
      name: 'Producto Secreto B',
      price: 20.0,
      isAvailable: true,
      sortOrder: 0,
      modifierGroups: [],
    },
  ];

  public productModifiers: { tenantId: string; productId: string; groupId: string }[] = [];

  async listByTenant(tenantId: string, filter?: { categoryId?: string; onlyAvailable?: boolean }): Promise<ProductDTO[]> {
    return this.products.filter((p) => {
      if (p.tenantId !== tenantId) return false;
      if (filter?.categoryId && p.categoryId !== filter.categoryId) return false;
      if (filter?.onlyAvailable && !p.isAvailable) return false;
      return true;
    });
  }

  async findById(tenantId: string, id: string): Promise<ProductDTO | null> {
    return this.products.find((p) => p.tenantId === tenantId && p.id === id) || null;
  }

  async save(tenantId: string, product: ProductDTO): Promise<ProductDTO> {
    const existing = this.products.find((p) => p.id === product.id);
    if (existing && existing.tenantId !== tenantId) {
      throw new DomainError('NOT_FOUND', `Producto ${product.id} no encontrado en este restaurante`);
    }

    const existingIndex = this.products.findIndex((p) => p.tenantId === tenantId && p.id === product.id);
    if (existingIndex >= 0) {
      this.products[existingIndex] = { ...product, tenantId };
    } else {
      this.products.push({ ...product, tenantId });
    }
    return product;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.products = this.products.filter((p) => !(p.tenantId === tenantId && p.id === id));
  }

  async setAvailability(tenantId: string, id: string, isAvailable: boolean): Promise<ProductDTO> {
    const product = await this.findById(tenantId, id);
    if (!product) {
      throw new DomainError('NOT_FOUND', `Producto ${id} no encontrado en este restaurante`);
    }
    product.isAvailable = isAvailable;
    return product;
  }

  async attachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void> {
    const product = await this.findById(tenantId, productId);
    if (!product) {
      throw new DomainError('NOT_FOUND', `Producto ${productId} no encontrado en este restaurante`);
    }
    const exists = this.productModifiers.some(
      (pm) => pm.tenantId === tenantId && pm.productId === productId && pm.groupId === groupId
    );
    if (!exists) {
      this.productModifiers.push({ tenantId, productId, groupId });
    }
  }

  async detachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void> {
    const product = await this.findById(tenantId, productId);
    if (!product) {
      throw new DomainError('NOT_FOUND', `Producto ${productId} no encontrado en este restaurante`);
    }
    this.productModifiers = this.productModifiers.filter(
      (pm) => !(pm.tenantId === tenantId && pm.productId === productId && pm.groupId === groupId)
    );
  }
}
