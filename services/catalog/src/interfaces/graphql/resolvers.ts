import { GraphQLError } from 'graphql';
import {
  CategoryRepository,
  ProductRepository,
  ModifierGroupRepository,
  DomainError,
} from '@packages/shared-types';
import { CreateCategoryUseCaseImpl, DeleteCategoryUseCaseImpl } from '../../application/CategoryUseCases';
import {
  CreateProductUseCaseImpl,
  UpdateProductUseCaseImpl,
  SetProductAvailabilityUseCaseImpl,
  AttachModifierGroupUseCaseImpl,
} from '../../application/ProductUseCases';
import { CreateModifierGroupUseCaseImpl } from '../../application/ModifierGroupUseCases';
import { CatalogContext } from './context';
import { requireRole } from './authz';

export function createResolvers(deps: {
  categoryRepo: CategoryRepository;
  productRepo: ProductRepository;
  modifierGroupRepo: ModifierGroupRepository;
}) {
  const { categoryRepo, productRepo, modifierGroupRepo } = deps;

  const createCategoryUseCase = new CreateCategoryUseCaseImpl(categoryRepo);
  const deleteCategoryUseCase = new DeleteCategoryUseCaseImpl(categoryRepo);
  const createProductUseCase = new CreateProductUseCaseImpl(productRepo, categoryRepo);
  const updateProductUseCase = new UpdateProductUseCaseImpl(productRepo);
  const setProductAvailabilityUseCase = new SetProductAvailabilityUseCaseImpl(productRepo);
  const attachModifierGroupUseCase = new AttachModifierGroupUseCaseImpl(productRepo);
  const createModifierGroupUseCase = new CreateModifierGroupUseCaseImpl(modifierGroupRepo);

  function toGraphQLError(err: any): never {
    if (err instanceof DomainError) {
      let code: string = err.code;
      if (code === 'VALIDATION_ERROR') {
        code = 'BAD_USER_INPUT';
      }
      throw new GraphQLError(err.message, {
        extensions: {
          code,
        },
      });
    }
    if (err instanceof GraphQLError) {
      throw err;
    }
    throw new GraphQLError(err.message || 'Internal server error', {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }

  return {
    Query: {
      categories: async (_parent: any, _args: any, context: CatalogContext) => {
        return categoryRepo.listByTenant(context.tenantId);
      },
      category: async (_parent: any, { id }: { id: string }, context: CatalogContext) => {
        return categoryRepo.findById(context.tenantId, id);
      },
      products: async (
        _parent: any,
        { categoryId, onlyAvailable }: { categoryId?: string; onlyAvailable?: boolean },
        context: CatalogContext
      ) => {
        const list = await productRepo.listByTenant(context.tenantId, { categoryId, onlyAvailable });
        return list.map((p) => ({ ...p, price: Number(p.price) }));
      },
      product: async (_parent: any, { id }: { id: string }, context: CatalogContext) => {
        const p = await productRepo.findById(context.tenantId, id);
        if (!p) return null;
        return { ...p, price: Number(p.price) };
      },
      modifierGroups: async (_parent: any, _args: any, context: CatalogContext) => {
        return modifierGroupRepo.listByTenant(context.tenantId);
      },
    },

    Mutation: {
      createCategory: async (_parent: any, { input }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          return await createCategoryUseCase.execute({ tenantId: context.tenantId, ...input });
        } catch (err) {
          toGraphQLError(err);
        }
      },
      updateCategory: async (_parent: any, { id, input }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          const existing = await categoryRepo.findById(context.tenantId, id);
          if (!existing) throw new DomainError('NOT_FOUND', `Categoría ${id} no encontrada`);
          const updated = { ...existing, ...input };
          return await categoryRepo.save(context.tenantId, updated);
        } catch (err) {
          toGraphQLError(err);
        }
      },
      deleteCategory: async (_parent: any, { id }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          await deleteCategoryUseCase.execute({ tenantId: context.tenantId, id });
          return true;
        } catch (err) {
          toGraphQLError(err);
        }
      },
      createProduct: async (_parent: any, { input }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          const p = await createProductUseCase.execute({ tenantId: context.tenantId, ...input });
          return { ...p, price: Number(p.price) };
        } catch (err) {
          toGraphQLError(err);
        }
      },
      updateProduct: async (_parent: any, { id, input }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          const p = await updateProductUseCase.execute({ tenantId: context.tenantId, id, ...input });
          return { ...p, price: Number(p.price) };
        } catch (err) {
          toGraphQLError(err);
        }
      },
      deleteProduct: async (_parent: any, { id }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          await productRepo.delete(context.tenantId, id);
          return true;
        } catch (err) {
          toGraphQLError(err);
        }
      },
      setProductAvailability: async (_parent: any, { id, isAvailable }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          const p = await setProductAvailabilityUseCase.execute({ tenantId: context.tenantId, id, isAvailable });
          return { ...p, price: Number(p.price) };
        } catch (err) {
          toGraphQLError(err);
        }
      },
      createModifierGroup: async (_parent: any, { input }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          return await createModifierGroupUseCase.execute({ tenantId: context.tenantId, ...input });
        } catch (err) {
          toGraphQLError(err);
        }
      },
      updateModifierGroup: async (_parent: any, { id, input }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          const existing = await modifierGroupRepo.findById(context.tenantId, id);
          if (!existing) throw new DomainError('NOT_FOUND', `Grupo ${id} no encontrado`);
          const updated = { ...existing, ...input };
          return await modifierGroupRepo.save(context.tenantId, updated);
        } catch (err) {
          toGraphQLError(err);
        }
      },
      deleteModifierGroup: async (_parent: any, { id }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          await modifierGroupRepo.delete(context.tenantId, id);
          return true;
        } catch (err) {
          toGraphQLError(err);
        }
      },
      addModifierOption: async (_parent: any, { groupId, input }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          const option = {
            id: `opt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            groupId,
            name: input.name,
            priceDelta: Number(input.priceDelta ?? 0),
            isDefault: input.isDefault ?? false,
          };
          return await modifierGroupRepo.addOption(context.tenantId, groupId, option);
        } catch (err) {
          toGraphQLError(err);
        }
      },
      removeModifierOption: async (_parent: any, { id }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          await modifierGroupRepo.removeOption(context.tenantId, id);
          return true;
        } catch (err) {
          toGraphQLError(err);
        }
      },
      attachModifierGroup: async (_parent: any, { productId, groupId }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          await attachModifierGroupUseCase.execute({ tenantId: context.tenantId, productId, groupId });
          const p = await productRepo.findById(context.tenantId, productId);
          if (!p) throw new DomainError('NOT_FOUND', 'Producto no encontrado');
          return { ...p, price: Number(p.price) };
        } catch (err) {
          toGraphQLError(err);
        }
      },
      detachModifierGroup: async (_parent: any, { productId, groupId }: any, context: CatalogContext) => {
        requireRole(context, ['ADMIN', 'MANAGER']);
        try {
          await productRepo.detachModifierGroup(context.tenantId, productId, groupId);
          const p = await productRepo.findById(context.tenantId, productId);
          if (!p) throw new DomainError('NOT_FOUND', 'Producto no encontrado');
          return { ...p, price: Number(p.price) };
        } catch (err) {
          toGraphQLError(err);
        }
      },
    },

    Product: {
      category: async (parent: any, _args: any, context: CatalogContext) => {
        const cat = await categoryRepo.findById(context.tenantId, parent.categoryId);
        return cat || { id: parent.categoryId, name: 'Default', sortOrder: 0, isActive: true, products: [] };
      },
      modifierGroups: async (parent: any, _args: any, _context: CatalogContext) => {
        if (parent.modifierGroups && parent.modifierGroups.length > 0) {
          return parent.modifierGroups.map((g: any) => ({
            ...g,
            options: (g.options || []).map((o: any) => ({
              ...o,
              priceDelta: Number(o.priceDelta),
            })),
          }));
        }
        return [];
      },
      price: (parent: any) => Number(parent.price),
      prepTimeMinutes: (parent: any) => (parent.prepTimeMinutes != null ? Number(parent.prepTimeMinutes) : null),
      imageUrl: (parent: any) => parent.imageUrl || null,
    },

    Category: {
      products: async (parent: any, _args: any, context: CatalogContext) => {
        const list = await productRepo.listByTenant(context.tenantId, { categoryId: parent.id });
        return list.map((p) => ({ ...p, price: Number(p.price) }));
      },
    },

    ModifierOption: {
      priceDelta: (parent: any) => Number(parent.priceDelta),
    },
  };
}
