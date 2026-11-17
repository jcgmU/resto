"use client";
import React, { useState } from 'react';
import {
  Avatar,
  AvailabilityToggle,
  Button,
  FeatureGuard,
  Modal,
  StatusCard,
  type ButtonVariant,
  type StatusCardStatus,
} from '@packages/ui-components';

const STATUSES: { status: StatusCardStatus; label: string }[] = [
  { status: 'available', label: 'Disponible' },
  { status: 'occupied', label: 'Ocupada' },
  { status: 'reserved', label: 'Reservada' },
];

const BUTTONS: ButtonVariant[] = ['primary', 'secondary', 'danger', 'link'];

const sectionTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: '1rem', color: 'var(--bento-text-strong)' };
const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' };

function Muestra() {
  const [modalOpen, setModalOpen] = useState(false);
  const [available, setAvailable] = useState(true);

  return (
    <div data-testid="dev-componentes" style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '8px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--bento-font-heading)' }}>Componentes compartidos</h1>

      <section>
        <h2 style={sectionTitle}>StatusCard: una vuelta de 4 s y queda arriba a la izquierda</h2>
        <div style={row}>
          {STATUSES.map(({ status, label }) => (
            <StatusCard key={status} status={status} style={{ width: '200px' }}>
              <strong>Mesa 1</strong>
              <div style={{ color: 'var(--bento-text-muted)' }}>{label}</div>
            </StatusCard>
          ))}
          <StatusCard status="available" animate={false} style={{ width: '200px' }}>
            <strong>Sin animación</strong>
          </StatusCard>
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>StatusCard de progreso: el blob se alarga por el borde superior</h2>
        <div style={row}>
          {([
            ['available', 0.25],
            ['reserved', 0.7],
            ['occupied', 1],
          ] as const).map(([status, progress]) => (
            <StatusCard key={status} status={status} variant="progress" progress={progress} style={{ width: '240px' }}>
              <strong>Pedido</strong>
              <div style={{ color: 'var(--bento-text-muted)' }}>{Math.round(progress * 100)}% del tiempo</div>
            </StatusCard>
          ))}
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>Button</h2>
        <div style={row}>
          {BUTTONS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button loading loadingLabel="Guardando...">
            Cargando
          </Button>
          <Button disabled>Deshabilitado</Button>
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>Avatar</h2>
        <div style={row}>
          <Avatar name="Carlos Mesero" />
          <Avatar name="Laura Caja" size={56} />
          <Avatar name="Foto rota" src="/no-existe.jpg" />
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>AvailabilityToggle</h2>
        <AvailabilityToggle checked={available} onChange={setAvailable} label="Disponibilidad del plato" />
      </section>

      <section>
        <h2 style={sectionTitle}>Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
        <Modal
          open={modalOpen}
          title="Nueva mesa"
          onClose={() => setModalOpen(false)}
          primaryLabel="Guardar mesa"
          onPrimary={() => setModalOpen(false)}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.875rem' }}>
            Nombre o identificador
            <input
              placeholder="Ej. Mesa 1"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--bento-inner-radius)',
                border: '1px solid var(--bento-field-border)',
                backgroundColor: 'var(--bento-field-bg)',
              }}
            />
          </label>
        </Modal>
      </section>
    </div>
  );
}

export default function DevComponentesPage() {
  return (
    <FeatureGuard
      flag="dev-components"
      fallback={<p style={{ color: 'var(--bento-text-muted)' }}>Próximamente</p>}
    >
      <Muestra />
    </FeatureGuard>
  );
}
