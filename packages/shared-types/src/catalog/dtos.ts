export interface CategoryDTO {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  products?: ProductDTO[];
}

export interface ProductDTO {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  sortOrder: number;
  prepTimeMinutes?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  category?: CategoryDTO;
  modifierGroups?: ModifierGroupDTO[];
}

export interface ModifierOptionDTO {
  id: string;
  groupId: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface ModifierGroupDTO {
  id: string;
  tenantId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: ModifierOptionDTO[];
  products?: ProductDTO[];
}
