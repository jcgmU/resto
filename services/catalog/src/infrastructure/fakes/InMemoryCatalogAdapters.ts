import {
  CategoryRepository,
  ProductRepository,
  ModifierGroupRepository,
  CategoryDTO,
  ProductDTO,
  ModifierGroupDTO,
  ModifierOptionDTO,
} from '@packages/shared-types';

export class InMemoryCategoryRepository implements CategoryRepository {
  public categories: CategoryDTO[] = [
    {
      id: 'cat-1',
      tenantId: 'tenant-100',
      name: 'Entradas',
      sortOrder: 0,
      isActive: true,
    },
    {
      id: 'category-with-products',
      tenantId: 'tenant-100',
      name: 'Platos Fuertes',
      sortOrder: 1,
      isActive: true,
    },
  ];

  async listByTenant(tenantId: string): Promise<CategoryDTO[]> {
    return this.categories
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  }

  async findById(tenantId: string, id: string): Promise<CategoryDTO | null> {
    return this.categories.find((c) => c.tenantId === tenantId && c.id === id) || null;
  }

  async save(tenantId: string, category: CategoryDTO): Promise<CategoryDTO> {
    const existingIndex = this.categories.findIndex((c) => c.tenantId === tenantId && c.id === category.id);
    if (existingIndex >= 0) {
      this.categories[existingIndex] = category;
    } else {
      this.categories.push({ ...category, tenantId });
    }
    return category;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.categories = this.categories.filter((c) => !(c.tenantId === tenantId && c.id === id));
  }

  async hasProducts(tenantId: string, id: string): Promise<boolean> {
    if (id === 'category-with-products') return true;
    return false;
  }
}

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
    return this.products
      .filter((p) => {
        if (p.tenantId !== tenantId) return false;
        if (filter?.categoryId && p.categoryId !== filter.categoryId) return false;
        if (filter?.onlyAvailable && !p.isAvailable) return false;
        return true;
      })
      .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  }

  async findById(tenantId: string, id: string): Promise<ProductDTO | null> {
    return this.products.find((p) => p.tenantId === tenantId && p.id === id) || null;
  }

  async save(tenantId: string, product: ProductDTO): Promise<ProductDTO> {
    const existingIndex = this.products.findIndex((p) => p.tenantId === tenantId && p.id === product.id);
    if (existingIndex >= 0) {
      this.products[existingIndex] = product;
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
      const newProd: ProductDTO = {
        id,
        tenantId,
        categoryId: 'cat-1',
        name: 'Producto Actualizado',
        price: 10,
        isAvailable,
        sortOrder: 0,
      };
      this.products.push(newProd);
      return newProd;
    }
    product.isAvailable = isAvailable;
    return product;
  }

  async attachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void> {
    const exists = this.productModifiers.some(
      (pm) => pm.tenantId === tenantId && pm.productId === productId && pm.groupId === groupId
    );
    if (!exists) {
      this.productModifiers.push({ tenantId, productId, groupId });
    }
  }

  async detachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void> {
    this.productModifiers = this.productModifiers.filter(
      (pm) => !(pm.tenantId === tenantId && pm.productId === productId && pm.groupId === groupId)
    );
  }
}

export class InMemoryModifierGroupRepository implements ModifierGroupRepository {
  public groups: ModifierGroupDTO[] = [
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
  ];

  async listByTenant(tenantId: string): Promise<ModifierGroupDTO[]> {
    return this.groups.filter((g) => g.tenantId === tenantId);
  }

  async findById(tenantId: string, id: string): Promise<ModifierGroupDTO | null> {
    return this.groups.find((g) => g.tenantId === tenantId && g.id === id) || null;
  }

  async save(tenantId: string, group: ModifierGroupDTO): Promise<ModifierGroupDTO> {
    const existingIndex = this.groups.findIndex((g) => g.tenantId === tenantId && g.id === group.id);
    if (existingIndex >= 0) {
      this.groups[existingIndex] = group;
    } else {
      this.groups.push({ ...group, tenantId });
    }
    return group;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.groups = this.groups.filter((g) => !(g.tenantId === tenantId && g.id === id));
  }

  async addOption(tenantId: string, groupId: string, option: ModifierOptionDTO): Promise<ModifierOptionDTO> {
    const group = await this.findById(tenantId, groupId);
    if (group) {
      group.options.push(option);
    }
    return option;
  }

  async removeOption(tenantId: string, optionId: string): Promise<void> {
    for (const group of this.groups) {
      if (group.tenantId === tenantId) {
        group.options = group.options.filter((o) => o.id !== optionId);
      }
    }
  }
}
