-- Moneda (ISO 4217) y locale (BCP 47) por tenant; los tenants existentes quedan en COP / es-CO.
ALTER TABLE "Tenant" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE "Tenant" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'es-CO';
