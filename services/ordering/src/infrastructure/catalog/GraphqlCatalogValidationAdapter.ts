import {
  CatalogValidationPort,
  ValidatedModifierGroup,
  ValidatedProduct,
} from '@packages/shared-types';
import { CatalogUnreachableError } from '../../domain/errors';

export const CATALOG_REQUEST_TIMEOUT_MS = 5000;

export class GraphqlCatalogValidationAdapter implements CatalogValidationPort {
  constructor(
    private readonly catalogUrl: string,
    private readonly timeoutMs: number = CATALOG_REQUEST_TIMEOUT_MS
  ) {}

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
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

          try {
            const res = await fetch(this.catalogUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': tenantId,
              },
              body: JSON.stringify({
                query,
                variables: { id },
              }),
              signal: controller.signal,
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
          } catch (err: any) {
            if (err.name === 'AbortError') {
              throw new CatalogUnreachableError('Timeout al conectar con Catalog');
            }
            throw err;
          } finally {
            clearTimeout(timeoutId);
          }
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
