import {
  CatalogValidationPort,
  ValidatedModifierGroup,
  ValidatedProduct,
} from '@packages/shared-types';
import { CatalogUnreachableError } from '../../domain/errors';

export class GraphqlCatalogValidationAdapter implements CatalogValidationPort {
  constructor(private readonly catalogUrl: string) {}

  async getOrderableProducts(tenantId: string, productIds: string[]): Promise<ValidatedProduct[]> {
    if (!productIds || productIds.length === 0) {
      return [];
    }

    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          name
          price
          isAvailable
          modifierGroups {
            id
            name
            minSelections
            maxSelections
            isRequired
            options {
              id
              name
              priceDelta
            }
          }
        }
      }
    `;

    try {
      const results = await Promise.all(
        productIds.map(async (id) => {
          const res = await fetch(this.catalogUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': tenantId,
              ...(process.env.INTERNAL_SHARED_SECRET
                ? { 'x-internal-token': process.env.INTERNAL_SHARED_SECRET }
                : {}),
            },
            body: JSON.stringify({
              query,
              variables: { id },
            }),
          });

          if (!res.ok) {
            throw new CatalogUnreachableError(`Catalog HTTP error: ${res.status}`);
          }

          const json: any = await res.json();
          if (json.errors && json.errors.length > 0) {
            throw new CatalogUnreachableError(json.errors[0].message);
          }

          const rawProduct = json.data?.product;
          if (!rawProduct) {
            return null;
          }

          const modifierGroups: ValidatedModifierGroup[] = (
            rawProduct.modifierGroups || []
          ).map((g: any) => ({
            groupId: g.id,
            name: g.name,
            minSelections: g.minSelections ?? 0,
            maxSelections: g.maxSelections ?? 0,
            isRequired: Boolean(g.isRequired),
            options: (g.options || []).map((o: any) => ({
              optionId: o.id,
              name: o.name,
              priceDelta: Number(o.priceDelta),
            })),
          }));

          const validated: ValidatedProduct = {
            productId: rawProduct.id,
            name: rawProduct.name,
            price: Number(rawProduct.price),
            isAvailable: Boolean(rawProduct.isAvailable),
            modifierGroups,
          };

          return validated;
        })
      );

      return results.filter((p): p is ValidatedProduct => p !== null);
    } catch (err: any) {
      if (err instanceof CatalogUnreachableError) {
        throw err;
      }
      throw new CatalogUnreachableError(err.message || 'Error al conectar con Catalog');
    }
  }
}
