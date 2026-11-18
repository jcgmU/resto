import { GraphQLError } from 'graphql';
import { CatalogContext } from './context';

export function requireRole(context: CatalogContext, allowedRoles: string[]): void {
  const currentRole = context.role?.toUpperCase();
  const allowed = allowedRoles.map((r) => r.toUpperCase());

  if (!currentRole || !allowed.includes(currentRole)) {
    throw new GraphQLError(
      `Acceso denegado: se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`,
      {
        extensions: {
          code: 'FORBIDDEN',
        },
      }
    );
  }
}
