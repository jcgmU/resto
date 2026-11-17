# Ordering: informe de ventas

`GET /v1/reports/sales/today?tz=America%2FBogota` consulta, a través del gateway, los pagos del día civil de la zona horaria IANA indicada. Requiere autenticación con rol ADMIN o MANAGER; los datos se filtran por el restaurante autenticado.

La respuesta tiene la forma `{"total":"0.00","tickets":0,"averageTicket":"0.00"}`. Cada pago cuenta como un ticket y los importes son cadenas decimales con dos cifras. Una zona horaria ausente o inválida devuelve 400; el intervalo incluye el inicio del día y excluye el inicio del siguiente.
