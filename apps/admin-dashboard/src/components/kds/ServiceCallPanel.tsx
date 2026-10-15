import React from 'react';
import { BentoCard, getTableDisplayName } from '@packages/ui-components';
import { ServiceCallDTO, TableDTO } from '@packages/shared-types';

export const SERVICE_CALL_TYPE_LABELS: Record<string, string> = {
  WAITER_CALL: 'Llamada de mesero',
  BILL_REQUEST: 'Solicitud de cuenta',
  GENERIC: 'Atención a mesa',
};

export interface ServiceCallPanelProps {
  calls: ServiceCallDTO[];
  tables?: TableDTO[];
  onResolve?: (callId: string) => void;
}

export function ServiceCallPanel({ calls, tables, onResolve }: ServiceCallPanelProps) {
  const pendingCalls = calls.filter((c) => c.status === 'pending');

  return (
    <BentoCard
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div
        style={{
          paddingBottom: '12px',
          borderBottom: '1px solid var(--bento-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--bento-text)',
              fontFamily: 'var(--bento-font-heading)',
            }}
          >
            Llamadas de Servicio
          </h3>
          <p
            style={{
              margin: '2px 0 0 0',
              fontSize: '11px',
              color: 'var(--bento-text-muted)',
            }}
          >
            Solicitudes en tiempo real enviadas por comensales
          </p>
          <span style={{ fontSize: '12px', color: 'var(--bento-text-muted)' }}>
            {pendingCalls.length} pendientes
          </span>
        </div>
      </div>
      {pendingCalls.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--bento-text-muted)',
            padding: '16px 0',
            textAlign: 'center',
          }}
        >
          No hay llamadas pendientes
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingCalls.map((call) => {
            const typeLabel =
              SERVICE_CALL_TYPE_LABELS[call.type || 'GENERIC'] ||
              call.type ||
              'Atención a mesa';

            return (
              <div
                key={call.callId}
                data-testid="service-call-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: 'var(--bento-inner-radius)',
                  border: '1px solid var(--bento-border)',
                  backgroundColor: 'var(--bento-papel)',
                  boxShadow: 'var(--bento-card-shadow)',
                  gap: '8px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '15px',
                        color: 'var(--bento-text)',
                        fontFamily: 'var(--bento-font-heading)',
                      }}
                    >
                      {getTableDisplayName(call.tableId, tables)}
                    </span>
                    <span
                      data-testid="service-call-type"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--bento-primary, #5c6784)',
                        backgroundColor: 'rgba(92, 103, 132, 0.1)',
                        padding: '2px 8px',
                        borderRadius: 'var(--bento-pill-radius, 9999px)',
                        border: '1px solid rgba(92, 103, 132, 0.2)',
                      }}
                    >
                      {typeLabel}
                    </span>
                  </div>

                  {call.note && (
                    <p
                      data-testid="service-call-note"
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: '13px',
                        color: 'var(--bento-text)',
                      }}
                    >
                      {call.note}
                    </p>
                  )}
                  <span
                    style={{
                      display: 'block',
                      marginTop: '4px',
                      fontSize: '11px',
                      color: 'var(--bento-text-muted)',
                    }}
                  >
                    {new Date(call.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {onResolve && (
                  <button
                    type="button"
                    aria-label={`Resolver llamada de la ${getTableDisplayName(call.tableId, tables)}`}
                    onClick={() => onResolve(call.callId)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: 'var(--bento-pill-radius)',
                      backgroundColor: 'var(--bento-hueso)',
                      color: 'var(--bento-text)',
                      border: '1px solid var(--bento-border)',
                      cursor: 'pointer',
                      fontFamily: 'var(--bento-font-body)',
                      minHeight: '36px',
                      flexShrink: 0,
                    }}
                  >
                    Resolver
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BentoCard>
  );
}
