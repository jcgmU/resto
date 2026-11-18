import { Router } from 'express';
import { GetTodaySales } from '../../application/GetTodaySales';
import { hasRole, REPORT_ROLES } from './authzRoles';

export function createReportsRouter(report: GetTodaySales): Router {
  const router = Router();
  router.get('/sales/today', async (req, res, next) => {
    try {
      if (!req.auth?.tenantId) return res.status(401).json({ error: { code: 'TENANT_REQUIRED', message: 'Identidad requerida' } });
      if (!hasRole(req.auth.role, REPORT_ROLES)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Acceso denegado' } });
      const tz = typeof req.query.tz === 'string' ? req.query.tz : '';
      return res.json(await report.execute(req.auth.tenantId, tz));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
