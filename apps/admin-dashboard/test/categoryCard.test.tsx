import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryCard } from '../src/components/CategoryCard';

describe('CategoryCard Component (Ronda 6 - Refined Layout & A11y)', () => {
  const baseCategory = {
    id: 'cat-1',
    name: 'Platos Fuertes',
    sortOrder: 1,
    destination: 'kitchen',
  };

  test('1. Renderiza estructura en 3 zonas con jerarquía clara y sin texto plano en botones de reorden', () => {
    render(
      <CategoryCard
        category={baseCategory}
        productCount={5}
        canMoveUp={true}
        canMoveDown={true}
        onMoveUp={jest.fn()}
        onMoveDown={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    // Zona 1: Título y botones de icono
    expect(screen.getByRole('heading', { level: 3, name: 'Platos Fuertes' })).toBeInTheDocument();

    const upBtn = screen.getByRole('button', { name: /subir categoría platos fuertes/i });
    const downBtn = screen.getByRole('button', { name: /bajar categoría platos fuertes/i });
    expect(upBtn).toBeInTheDocument();
    expect(downBtn).toBeInTheDocument();

    // No debe tener texto "Subir" o "Bajar" plano que desborde
    expect(screen.queryByText(/^subir$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^bajar$/i)).not.toBeInTheDocument();

    // Debe contener SVGs para los iconos
    expect(upBtn.querySelector('svg')).toBeInTheDocument();
    expect(downBtn.querySelector('svg')).toBeInTheDocument();

    // Zona 2: Etiqueta de destino y conteo de platos
    expect(screen.getByText('Cocina')).toBeInTheDocument();
    expect(screen.getByText('5 platos')).toBeInTheDocument();

    // Zona 3: Acciones primarias y destructivas separadas
    expect(screen.getByRole('button', { name: /editar categoría platos fuertes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar categoría platos fuertes/i })).toBeInTheDocument();
  });

  test('2. Distingue visualmente destino Cocina vs Bar con chips semánticos de la Suite', () => {
    const { rerender } = render(
      <CategoryCard
        category={{ ...baseCategory, destination: 'kitchen' }}
        productCount={1}
      />
    );

    expect(screen.getByText('Cocina')).toBeInTheDocument();
    expect(screen.getByText('1 plato')).toBeInTheDocument();

    // Re-render con Bar
    rerender(
      <CategoryCard
        category={{ ...baseCategory, id: 'cat-2', name: 'Cocteles', destination: 'bar' }}
        productCount={3}
      />
    );

    expect(screen.getByText('Bar')).toBeInTheDocument();
    expect(screen.getByText('3 platos')).toBeInTheDocument();
  });

  test('3. Botón Eliminar utiliza token de texto destructivo accesible (>= 4.5:1)', () => {
    render(
      <CategoryCard
        category={baseCategory}
        onDelete={jest.fn()}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /eliminar categoría platos fuertes/i });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).toHaveAttribute('data-destructive', 'true');
    expect(deleteBtn).toHaveAttribute('data-color-token', 'var(--bento-status-occupied-text)');

    // Verificación de código fuente para garantizar que no se use var(--bento-destructive) para color de texto
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../src/components/CategoryCard.tsx'), 'utf8');
    expect(source).toContain("color: 'var(--bento-status-occupied-text)'");
    expect(source).not.toMatch(/color:\s*['"]var\(--bento-destructive\)['"]/);
  });

  test('4. Estados deshabilitados de Subir y Bajar aplican disabled y estilo coherente', () => {
    render(
      <CategoryCard
        category={baseCategory}
        canMoveUp={false}
        canMoveDown={true}
        onMoveUp={jest.fn()}
        onMoveDown={jest.fn()}
      />
    );

    const upBtn = screen.getByRole('button', { name: /subir categoría platos fuertes/i });
    const downBtn = screen.getByRole('button', { name: /bajar categoría platos fuertes/i });

    expect(upBtn).toBeDisabled();
    expect(downBtn).not.toBeDisabled();

    const upStyle = upBtn.getAttribute('style') || '';
    expect(upStyle).toContain('not-allowed');
  });

  test('5. Dispara callbacks onMoveUp, onMoveDown, onEdit, onDelete al hacer clic', () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <CategoryCard
        category={baseCategory}
        canMoveUp={true}
        canMoveDown={true}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /subir categoría platos fuertes/i }));
    expect(onMoveUp).toHaveBeenCalledWith(baseCategory);

    fireEvent.click(screen.getByRole('button', { name: /bajar categoría platos fuertes/i }));
    expect(onMoveDown).toHaveBeenCalledWith(baseCategory);

    fireEvent.click(screen.getByRole('button', { name: /editar categoría platos fuertes/i }));
    expect(onEdit).toHaveBeenCalledWith(baseCategory);

    fireEvent.click(screen.getByRole('button', { name: /eliminar categoría platos fuertes/i }));
    expect(onDelete).toHaveBeenCalledWith(baseCategory);
  });
});
