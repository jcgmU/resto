import { ApiClient } from '../api';
import type { CategoryDTO, ProductDTO } from '@packages/shared-types';

export interface CreateProductParams {
  categoryId: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  prepTimeMinutes?: number;
  isAvailable?: boolean;
}

export interface UpdateProductParams {
  name?: string;
  price?: number;
  categoryId?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  prepTimeMinutes?: number;
  isAvailable?: boolean;
}

export interface CreateCategoryParams {
  name: string;
  sortOrder?: number;
  destination?: 'kitchen' | 'bar';
}

export interface UpdateCategoryParams {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  destination?: 'kitchen' | 'bar';
}

export async function fetchMenu(): Promise<{ categories: CategoryDTO[]; products: ProductDTO[] }> {
  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query AdminMenu {
          categories {
            id
            name
            sortOrder
            isActive
            destination
          }
          products {
            id
            name
            description
            price
            imageUrl
            isAvailable
            sortOrder
            prepTimeMinutes
            category {
              id
              name
            }
          }
        }
      `,
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error en consulta GraphQL');
  }

  const fetchedCats: CategoryDTO[] = res?.data?.data?.categories || [];
  const rawProds: any[] = res?.data?.data?.products || [];
  const mappedProds: ProductDTO[] = rawProds.map((p) => ({
    id: p.id,
    tenantId: p.tenantId || '',
    name: p.name,
    description: p.description ?? null,
    price: Number(p.price),
    imageUrl: p.imageUrl ?? null,
    isAvailable: p.isAvailable !== false,
    sortOrder: p.sortOrder ?? 0,
    prepTimeMinutes: p.prepTimeMinutes != null ? Number(p.prepTimeMinutes) : 15,
    categoryId: p.categoryId ?? p.category?.id ?? '',
    category: p.category,
  }));

  return { categories: fetchedCats, products: mappedProds };
}

export async function setProductAvailability(id: string, isAvailable: boolean): Promise<any> {
  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation SetAvailability($id: ID!, $isAvailable: Boolean!) {
          setProductAvailability(id: $id, isAvailable: $isAvailable) {
            id
            isAvailable
          }
        }
      `,
      variables: { id, isAvailable },
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error al actualizar disponibilidad');
  }

  return res?.data?.data?.setProductAvailability;
}

export async function createProduct(input: CreateProductParams): Promise<ProductDTO> {
  const variablesInput: any = {
    categoryId: input.categoryId,
    name: input.name,
    price: input.price,
  };
  if (input.description !== undefined) variablesInput.description = input.description;
  if (input.imageUrl !== undefined) variablesInput.imageUrl = input.imageUrl;
  if (input.sortOrder !== undefined) variablesInput.sortOrder = input.sortOrder;
  if (input.prepTimeMinutes !== undefined) variablesInput.prepTimeMinutes = input.prepTimeMinutes;

  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateProduct($input: CreateProductInput!) {
          createProduct(input: $input) {
            id
            name
            description
            price
            imageUrl
            isAvailable
            sortOrder
            prepTimeMinutes
            category {
              id
            }
          }
        }
      `,
      variables: { input: variablesInput },
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error al crear producto');
  }

  const created = res?.data?.data?.createProduct;
  if (!created) {
    throw new Error('No se recibió el producto creado');
  }

  // Si isAvailable se especificó como false, asegurar sincronización
  if (input.isAvailable === false && created.id) {
    try {
      await setProductAvailability(created.id, false);
      created.isAvailable = false;
    } catch {
      // Ignorar fallo de sincronización secundaria
    }
  }

  return {
    id: created.id,
    tenantId: created.tenantId || '',
    name: created.name,
    description: created.description ?? null,
    price: Number(created.price),
    imageUrl: created.imageUrl ?? null,
    isAvailable: created.isAvailable !== false,
    sortOrder: created.sortOrder ?? 0,
    prepTimeMinutes: created.prepTimeMinutes != null ? Number(created.prepTimeMinutes) : 15,
    categoryId: created.categoryId ?? created.category?.id ?? input.categoryId,
    category: created.category,
  };
}

export async function updateProduct(id: string, input: UpdateProductParams): Promise<ProductDTO> {
  const variablesInput: any = {};
  if (input.name !== undefined) variablesInput.name = input.name;
  if (input.price !== undefined) variablesInput.price = input.price;
  if (input.categoryId !== undefined) variablesInput.categoryId = input.categoryId;
  if (input.description !== undefined) variablesInput.description = input.description;
  if (input.imageUrl !== undefined) variablesInput.imageUrl = input.imageUrl;
  if (input.sortOrder !== undefined) variablesInput.sortOrder = input.sortOrder;
  if (input.prepTimeMinutes !== undefined) variablesInput.prepTimeMinutes = input.prepTimeMinutes;

  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
          updateProduct(id: $id, input: $input) {
            id
            name
            description
            price
            imageUrl
            isAvailable
            sortOrder
            prepTimeMinutes
            category {
              id
            }
          }
        }
      `,
      variables: { id, input: variablesInput },
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error al actualizar producto');
  }

  const updated = res?.data?.data?.updateProduct;

  if (input.isAvailable !== undefined) {
    try {
      await setProductAvailability(id, input.isAvailable);
      if (updated) updated.isAvailable = input.isAvailable;
    } catch {
      // Ignorar fallo secundario
    }
  }

  return {
    id: updated?.id || id,
    tenantId: updated?.tenantId || '',
    name: updated?.name || input.name || '',
    description: updated?.description ?? input.description ?? null,
    price: Number(updated?.price ?? input.price ?? 0),
    imageUrl: updated?.imageUrl ?? input.imageUrl ?? null,
    isAvailable: updated?.isAvailable ?? input.isAvailable ?? true,
    sortOrder: updated?.sortOrder ?? input.sortOrder ?? 0,
    prepTimeMinutes: updated?.prepTimeMinutes != null ? Number(updated.prepTimeMinutes) : 15,
    categoryId: updated?.categoryId ?? updated?.category?.id ?? input.categoryId ?? '',
    category: updated?.category,
  };
}

export async function deleteProduct(id: string): Promise<boolean> {
  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation DeleteProduct($id: ID!) {
          deleteProduct(id: $id)
        }
      `,
      variables: { id },
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error al eliminar producto');
  }

  return res?.data?.data?.deleteProduct ?? true;
}

export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
  const token = (await ApiClient.getValidAccessToken()) || ApiClient.token;
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}/v1/uploads`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.error?.message || data?.message || 'Error al subir imagen';
    throw new Error(message);
  }

  const data = await res.json();
  return data;
}

export async function createCategory(input: CreateCategoryParams): Promise<CategoryDTO> {
  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation CreateCategory($input: CreateCategoryInput!) {
          createCategory(input: $input) {
            id
            name
            sortOrder
            destination
          }
        }
      `,
      variables: {
        input: {
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
          destination: input.destination || 'kitchen',
        },
      },
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error al crear categoría');
  }

  return res?.data?.data?.createCategory;
}

export async function updateCategory(id: string, input: UpdateCategoryParams): Promise<CategoryDTO> {
  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
          updateCategory(id: $id, input: $input) {
            id
            name
            sortOrder
            isActive
            destination
          }
        }
      `,
      variables: {
        id,
        input,
      },
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error al actualizar categoría');
  }

  return res?.data?.data?.updateCategory;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        mutation DeleteCategory($id: ID!) {
          deleteCategory(id: $id)
        }
      `,
      variables: { id },
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error al eliminar categoría');
  }

  return res?.data?.data?.deleteCategory ?? true;
}
