# ADR — Coordinación local de pedido y cobro en hardening-p1

- Estado: propuesta de ejecución, pendiente de reproducción RED y revisión de implementación.
- Fecha: 2026-10-26.
- Autor: codex, planificador.
- Plan: `brain/Handoffs/2026-10-26-2112-codex-a-agy.md`, U4/U9.
- Enmienda vigente del usuario: `brain/Handoffs/2026-10-26-2330-claude-a-agy.md`, ronda 2.

El usuario decidió un máximo de **99 unidades por línea**: solo enteros de 1 a 99, tanto en HTTP como en casos de uso y pricing, incluida la suma de adiciones a una misma línea. Una constante única de ordering debe representar este límite; los límites técnicos Int/Decimal siguen siendo defensas adicionales, y no sustituyen el tope comercial. Los bordes obligatorios son 99 válido, 100/1000 inválidos con HTTP 400 VALIDATION_ERROR y fusión que supere 99 rechazada sin escritura ni evento. La restauración de reservas de U9 también respeta 99 y conserva datos ante un conflicto, sin truncarlos.

El usuario fijó además un punto de control al terminar las oleadas 0–2: **U0, U1, U2, U3, U4 y U5**. Agy debe detenerse y entregar ejecución parcial; Codex revisa personalmente diff, tests, build y evidencia RED/GREEN antes de emitir listo-para-verificar parcial a claude. Las oleadas 3–6 requieren nueva autorización de claude. La revisión parcial puede aceptar cantidades, autorización/tenant de catálogo, protección postpago/carrera pedido-cobro, cancelación vigente y checkout admin; no acredita refresh, unicidad QR, reservas/carrito concurrente, CI ni integración final pendientes. Admin-spa sigue pendiente de indicación.

Una lectura separada de Payment o del estado de sesión no impide que un pedido se guarde después de calcular y registrar un pago. El carrito Redis también puede recibir adiciones entre el snapshot del pedido y el borrado global actual. Los dos riesgos necesitan pruebas con adaptadores reales; esta propuesta todavía no afirma que estén corregidos.

Se propone un puerto local de unidad de trabajo en ordering por tenant/session. Su adaptador usa Prisma interactive transaction y pg_advisory_xact_lock; las lecturas y escrituras autoritativas de Order/Payment usan el mismo cliente transaccional después del lock. Las mutaciones de carrito comprueban pago/sesión bajo la coordinación común. La verificación del estado de session sigue siendo HTTP mediante un puerto local: ordering no accede al Redis ni al dominio de session. Los contratos públicos de shared-types permanecen compatibles.

Se propone reservar atómicamente un snapshot Redis con operationId/orderId estable y dar ack únicamente a esa reserva después del commit PostgreSQL. Recuperar reservas bajo la coordinación común antes de avanzar: orden ya persistida implica ack; ausencia de orden implica restore conservando trabajo posterior. Una reserva incompatible se conserva con conflicto recuperable. No se asume una transacción distribuida ni entrega exactamente una vez de Pub/Sub; no se acepta DEL del carrito vivo al confirmar.

Se conserva pago persistido → cierre HTTP existente → limpieza propia → checkout-completed, fijado por el manifiesto específico de Oleada5. Hay una diferencia histórica con la regla general de mutaciones cross-dominio por eventos de CLAUDE.md. Este hilo no migra ese flujo a saga ni outbox: claude debe conocer y evaluar esa diferencia por separado.

El costo es introducir coordinación y recuperación locales, adaptar repositorios a transacciones y probar dos instancias independientes. Las garantías se aceptarán solo con barreras deterministas, Redis/Postgres reales, fallos antes/después del commit, reintentos y regresión completa. La política adicional de cancelación después del pago y la atomicidad de refresh entre distintos clientes no quedan resueltas por esta decisión.
