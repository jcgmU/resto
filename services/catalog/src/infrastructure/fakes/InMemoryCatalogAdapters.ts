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
    {
      id: 'cat-b',
      tenantId: 'tenant-B',
      name: 'Bebidas B',
      sortOrder: 0,
      isActive: true,
    },
  ];

  async listByTenant(tenantId: string): Promise<CategoryDTO[]> {
    return this.categories.filter((c) => c.tenantId === tenantId);
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

export { InMemoryProductRepository } from '../persistence/InMemoryProductRepository';

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
    {
      id: 'group-of-tenant-B',
      tenantId: 'tenant-B',
      name: 'Extras B',
      minSelections: 0,
      maxSelections: 2,
      isRequired: false,
      options: [],
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
