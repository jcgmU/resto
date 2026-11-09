"use client";
import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BentoGrid,
  BentoCard,
  TabsPill,
  Skeleton,
  EmptyState,
  ErrorState,
} from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';
import { canMutateTables, updateTablesBatch } from '../../../lib/tablesApi';
import { TableItem, TableQrData } from '../../../components/mesas/types';
import { useTablesData } from '../../../components/mesas/useTablesData';
import { useTableSelection } from '../../../components/mesas/useTableSelection';
import { TableCard, TableMapSlot } from '../../../components/mesas/TableCard';
import { CreateTableModal } from '../../../components/mesas/CreateTableModal';
import { CreateTablesBatchModal } from '../../../components/mesas/CreateTablesBatchModal';
import { EditTableModal } from '../../../components/mesas/EditTableModal';
import { BatchEditModal } from '../../../components/mesas/BatchEditModal';
import { BulkActionBar } from '../../../components/mesas/BulkActionBar';
import { DeleteTablesDialog } from '../../../components/mesas/DeleteTablesDialog';
import { QrModal } from '../../../components/mesas/QrModal';

export default function TablesPage() {
  const {
    tables,
    occupiedTableIds,
    loading,
    error,
    fetchTablesAndSessions,
    getTableStatus,
  } = useTablesData();

  const canMutate = canMutateTables(ApiClient.token);

  const {
    isSelected,
    toggleOne,
    toggleAllVisible,
    clearSelection,
    selectedCount,
    allVisibleSelected,
    selectedTables,
  } = useTableSelection(tables);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Modal Crear Mesa individual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Modales de Lote, Edición y Eliminación
  const [showBatchCreateModal, setShowBatchCreateModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [tablesToDelete, setTablesToDelete] = useState<TableItem[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchActionError, setBatchActionError] = useState<string | null>(null);

  // Modal / Vista de QR
  const [activeTableQr, setActiveTableQr] = useState<TableItem | null>(null);
  const [qrData, setQrData] = useState<TableQrData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const handleQuickBatchStatus = async (status: 'active' | 'inactive') => {
    if (selectedTables.length === 0 || batchBusy) return;
    setBatchBusy(true);
    setBatchActionError(null);
    try {
      await updateTablesBatch(
        selectedTables.map((t) => ({ tableId: t.tableId, status }))
      );
      await fetchTablesAndSessions();
      clearSelection();
    } catch (err: any) {
      setBatchActionError(err?.message || 'Error al actualizar mesas en lote');
    } finally {
      setBatchBusy(false);
    }
  };

  const handleOpenCreateModal = () => {
    setNewTableLabel('');
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setCreateError(null);
  }, []);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) {
      setCreateError('Por favor ingresa un nombre para la mesa');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      await ApiClient.request('/v1/tables', {
        method: 'POST',
        body: JSON.stringify({ label: newTableLabel.trim() }),
      });
      setShowCreateModal(false);
      setNewTableLabel('');
      await fetchTablesAndSessions();
    } catch (err: any) {
      setCreateError(err?.message || 'Error al crear la mesa');
    } finally {
      setCreating(false);
    }
  };

  const handleViewQr = async (table: TableItem) => {
    setActiveTableQr(table);
    setQrData(null);
    setQrError(null);
    setQrLoading(true);

    try {
      const res = await ApiClient.request(`/v1/tables/${table.tableId}/qr`, { method: 'GET' });
      setQrData(res.data || res);
    } catch (err: any) {
      setQrError(err?.message || 'Error al cargar el código QR');
    } finally {
      setQrLoading(false);
    }
  };

  const handleRotateQr = async (table: TableItem) => {
    setQrLoading(true);
    setQrError(null);

    try {
      const res = await ApiClient.request(`/v1/tables/${table.tableId}/qr/rotate`, {
        method: 'POST',
      });
      setQrData(res.data || res);
    } catch (err: any) {
      setQrError(err?.message || 'Error al rotar el código QR');
    } finally {
      setQrLoading(false);
    }
  };

  const handleCloseQrModal = useCallback(() => {
    setActiveTableQr(null);
    setQrData(null);
    setQrError(null);
  }, []);

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'var(--bento-font-body)',
        color: 'var(--bento-text)',
      }}
    >
      {/* Header y Acciones */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Mesas y Códigos QR
            </h1>
            <Link
              href="/menu"
              style={{
                fontSize: '0.875rem',
                color: 'var(--bento-text)',
                textDecoration: 'none',
                fontWeight: 500,
                border: '1px solid var(--bento-border)',
                padding: '4px 12px',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'var(--bento-papel)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ← Ir a Menú
            </Link>
          </div>
          <p
            style={{
              margin: '4px 0 0 0',
              color: 'var(--bento-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Control de mesas activas y generación de códigos QR de autoservicio
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {tables.length > 0 && (
            <TabsPill
              tabs={[
                { id: 'list', label: 'Lista', count: tables.length },
                { id: 'map', label: 'Mapa', count: tables.length },
              ]}
              value={viewMode}
              onChange={(id) => setViewMode(id as 'list' | 'map')}
              ariaLabel="Cambiar vista de mesas"
            />
          )}

          {canMutate && tables.length > 0 && selectedCount === 0 && (
            <button
              type="button"
              onClick={() => toggleAllVisible()}
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--bento-papel)',
                color: 'var(--bento-text)',
                borderRadius: 'var(--bento-pill-radius)',
                border: '1px solid var(--bento-border)',
                fontFamily: 'var(--bento-font-body)',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '40px',
              }}
            >
              Seleccionar todas
            </button>
          )}

          {canMutate && (
            <>
              <button
                type="button"
                onClick={() => setShowBatchCreateModal(true)}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-text)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-border)',
                  fontFamily: 'var(--bento-font-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '40px',
                }}
              >
                Crear en lote
              </button>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'var(--bento-tinta)',
                  color: 'var(--bento-papel)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-tinta)',
                  fontFamily: 'var(--bento-font-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--bento-card-shadow)',
                  minHeight: '40px',
                }}
              >
                Nueva Mesa
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barra de acciones en lote */}
      {canMutate && selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          totalCount={tables.length}
          allSelected={allVisibleSelected}
          busy={batchBusy}
          onToggleSelectAll={() => toggleAllVisible()}
          onClearSelection={clearSelection}
          onActivateSelected={() => handleQuickBatchStatus('active')}
          onDeactivateSelected={() => handleQuickBatchStatus('inactive')}
          onBatchEditSelected={() => setShowBatchEditModal(true)}
          onDeleteSelected={() => setTablesToDelete(selectedTables)}
        />
      )}

      {/* Error no-bloqueante cuando ya hay mesas o de acciones en lote */}
      {((error && tables.length > 0) || batchActionError) && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bento-papel)',
            color: 'var(--bento-destructive)',
            border: '1px solid var(--bento-destructive)',
            borderRadius: 'var(--bento-inner-radius)',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          {batchActionError || error}
        </div>
      )}

      {/* Estados principales: Loading / Error / Empty / OK */}
      {loading && tables.length === 0 ? (
        <div
          role="status"
          aria-label="Cargando mesas..."
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--bento-grid-gap)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
            }}
          >
            Cargando mesas...
          </span>
          <BentoGrid cols={3}>
            {[1, 2, 3].map((n) => (
              <BentoCard key={n}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
                  <Skeleton height="28px" width="60%" />
                  <Skeleton height="16px" width="40%" />
                  <Skeleton height="40px" width="100%" radius="var(--bento-pill-radius)" />
                </div>
              </BentoCard>
            ))}
          </BentoGrid>
        </div>
      ) : !loading && error && tables.length === 0 ? (
        <ErrorState
          title="Error al cargar las mesas"
          message={error}
          onRetry={() => fetchTablesAndSessions()}
          retryLabel="Reintentar"
        />
      ) : tables.length === 0 ? (
        <EmptyState
          title="No hay mesas registradas"
          description="Agrega tu primera mesa para generar su código QR único de acceso."
          action={
            canMutate ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  style={{
                    minHeight: '44px',
                    padding: '0 20px',
                    backgroundColor: 'var(--bento-tinta)',
                    color: 'var(--bento-papel)',
                    border: '1px solid var(--bento-tinta)',
                    borderRadius: 'var(--bento-pill-radius)',
                    fontFamily: 'var(--bento-font-body)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Crear primera mesa
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchCreateModal(true)}
                  style={{
                    minHeight: '44px',
                    padding: '0 20px',
                    backgroundColor: 'var(--bento-papel)',
                    color: 'var(--bento-text)',
                    border: '1px solid var(--bento-border)',
                    borderRadius: 'var(--bento-pill-radius)',
                    fontFamily: 'var(--bento-font-body)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Crear en lote
                </button>
              </div>
            ) : undefined
          }
        />
      ) : viewMode === 'list' ? (
        /* Vista de Lista (BentoGrid) */
        <BentoGrid cols={3}>
          {tables.map((table) => (
            <TableCard
              key={table.tableId}
              table={table}
              statusInfo={getTableStatus(table)}
              onViewQr={handleViewQr}
              canMutate={canMutate}
              selected={isSelected(table.tableId)}
              onToggleSelect={toggleOne}
              onEdit={(t) => setEditingTable(t)}
              onDelete={(t) => setTablesToDelete([t])}
            />
          ))}
        </BentoGrid>
      ) : (
        /* Vista de Mapa de Mesas (Grid de slots) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Leyenda clara */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '12px 18px',
              backgroundColor: 'var(--bento-papel)',
              borderRadius: 'var(--bento-inner-radius)',
              border: '1px solid var(--bento-border)',
              flexWrap: 'wrap',
              fontSize: '0.875rem',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Leyenda:
            </span>

            {/* Ocupada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bento-tinta)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--bento-text)' }}>
                <strong>Ocupada</strong> (con sesión activa)
              </span>
            </div>

            {/* Libre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bento-papel)',
                  border: '1px dashed var(--bento-border)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--bento-text)' }}>
                <strong>Libre</strong> (disponible)
              </span>
            </div>

            {/* Deshabilitada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bento-hueso)',
                  border: '1px solid var(--bento-border)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--bento-text-muted)' }}>Deshabilitada</span>
            </div>
          </div>

          {/* Grid de slots */}
          <div
            data-testid="tables-map-grid"
            style={{
              display: 'grid',
              gap: 'var(--bento-grid-gap)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            }}
          >
            {tables.map((table) => (
              <TableMapSlot
                key={table.tableId}
                table={table}
                statusInfo={getTableStatus(table)}
                onViewQr={handleViewQr}
                canMutate={canMutate}
                selected={isSelected(table.tableId)}
                onToggleSelect={toggleOne}
                onEdit={(t) => setEditingTable(t)}
                onDelete={(t) => setTablesToDelete([t])}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal Crear Mesa */}
      <CreateTableModal
        open={showCreateModal}
        labelValue={newTableLabel}
        onChangeLabel={setNewTableLabel}
        error={createError}
        creating={creating}
        onSubmit={handleCreateTable}
        onClose={handleCloseCreateModal}
      />

      {/* Modal Crear Mesas en Lote */}
      <CreateTablesBatchModal
        open={showBatchCreateModal}
        existingTables={tables}
        onClose={() => setShowBatchCreateModal(false)}
        onSuccess={async () => {
          await fetchTablesAndSessions();
        }}
      />

      {/* Modal Editar Mesa Individual */}
      <EditTableModal
        table={editingTable}
        onClose={() => setEditingTable(null)}
        onSuccess={async () => {
          await fetchTablesAndSessions();
        }}
      />

      {/* Modal Editar / Renombrar Mesas en Lote */}
      <BatchEditModal
        open={showBatchEditModal}
        tables={selectedTables}
        onClose={() => setShowBatchEditModal(false)}
        onSuccess={async () => {
          await fetchTablesAndSessions();
          clearSelection();
        }}
      />

      {/* Modal Eliminar Mesas (Individual o Lote) */}
      <DeleteTablesDialog
        open={tablesToDelete.length > 0}
        tablesToDelete={tablesToDelete}
        occupiedTableIds={occupiedTableIds}
        onClose={() => setTablesToDelete([])}
        onCompleted={async (res) => {
          await fetchTablesAndSessions();
          if (res.failed.length === 0) {
            clearSelection();
          }
        }}
      />

      {/* Modal Ver / Rotar QR con tokens Bento: backgroundColor var(--bento-tinta) y color var(--bento-papel) */}
      <QrModal
        activeTableQr={activeTableQr}
        qrData={qrData}
        qrLoading={qrLoading}
        qrError={qrError}
        onRotateQr={handleRotateQr}
        onClose={handleCloseQrModal}
      />
    </div>
  );
}
