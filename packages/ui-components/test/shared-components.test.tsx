import '@testing-library/jest-dom';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { Modal, Button, Avatar, AvailabilityToggle, BENTO_TOKENS } from '../src';

const css = fs.readFileSync(path.resolve(__dirname, '../src/bento/bento.css'), 'utf8');
const ruleOf = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
};

describe('Button', () => {
  test.each(['primary', 'secondary', 'danger', 'link'] as const)('variante %s', (variant) => {
    render(<Button variant={variant}>Acción</Button>);
    const button = screen.getByRole('button', { name: 'Acción' });
    expect(button).toHaveAttribute('data-variant', variant);
  });

  test('ninguna variante usa borde de color marcado', () => {
    for (const variant of ['primary', 'secondary', 'danger', 'link'] as const) {
      const { unmount } = render(<Button variant={variant}>x</Button>);
      const style = screen.getByRole('button').getAttribute('style') || '';
      expect(style).not.toMatch(/border:[^;]*(destructive|primary|accent|success|warning)/);
      unmount();
    }
  });

  test('loading deshabilita y muestra el texto de carga', () => {
    const onClick = jest.fn();
    render(
      <Button loading loadingLabel="Guardando..." onClick={onClick}>
        Guardar
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Guardando...');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('por defecto es type="button"', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Avatar', () => {
  test('con foto muestra la imagen con el nombre como alt', () => {
    render(<Avatar name="Carlos Mesero" src="/fotos/carlos.jpg" />);
    expect(screen.getByRole('img', { name: 'Carlos Mesero' })).toHaveAttribute('src', '/fotos/carlos.jpg');
  });

  test('sin foto muestra las iniciales', () => {
    render(<Avatar name="Carlos Mesero" />);
    expect(screen.getByText('CM')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  test('si la imagen falla vuelve a las iniciales', () => {
    render(<Avatar name="Laura Caja" src="/rota.jpg" />);
    fireEvent.error(screen.getByRole('img', { name: 'Laura Caja' }));
    expect(screen.getByText('LC')).toBeInTheDocument();
  });

  test('un solo nombre da una inicial', () => {
    render(<Avatar name="admin" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});

describe('AvailabilityToggle', () => {
  function Harness() {
    const [on, setOn] = useState(true);
    return <AvailabilityToggle checked={on} onChange={setOn} label="Disponibilidad del plato" />;
  }

  test('es un botón que alterna, muestra el estado y cambia de color', () => {
    render(<Harness />);
    const toggle = screen.getByRole('switch', { name: /Disponibilidad del plato/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveTextContent('Disponible');
    expect(toggle).toHaveAttribute('data-state', 'on');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('No disponible');
    expect(toggle).toHaveAttribute('data-state', 'off');
  });
});

describe('Modal', () => {
  test('cerrado no renderiza nada', () => {
    render(
      <Modal open={false} title="Nueva mesa" onClose={() => {}}>
        contenido
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('abierto: diálogo con título, contenido, Cancelar y acción primaria', () => {
    const onClose = jest.fn();
    const onPrimary = jest.fn();
    render(
      <Modal open title="Nueva mesa" onClose={onClose} primaryLabel="Guardar mesa" onPrimary={onPrimary}>
        <input aria-label="Nombre" />
      </Modal>
    );
    const dialog = screen.getByRole('dialog', { name: 'Nueva mesa' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mesa' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape y clic en el fondo cierran', () => {
    const onClose = jest.fn();
    render(
      <Modal open title="T" onClose={onClose}>
        x
      </Modal>
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('el foco entra al diálogo y vuelve al botón que lo abrió', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          <Modal open={open} title="T" onClose={() => setOpen(false)}>
            <input aria-label="Campo" />
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(document.activeElement).toBe(opener);
  });

  test('onClose cambia entre renders sin reiniciar el foco ni los listeners (patrón onCloseRef)', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(
      <Modal open title="T" onClose={first}>
        <input aria-label="Campo" />
      </Modal>
    );
    const field = screen.getByLabelText('Campo');
    field.focus();
    rerender(
      <Modal open title="T" onClose={second}>
        <input aria-label="Campo" />
      </Modal>
    );
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('con onSubmit envuelve en formulario y la acción primaria envía', () => {
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <Modal open title="T" onClose={() => {}} primaryLabel="Crear" onSubmit={onSubmit}>
        <input aria-label="Nombre" />
      </Modal>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('tono peligro y estado de carga de la acción primaria', () => {
    render(
      <Modal open title="Eliminar" onClose={() => {}} primaryLabel="Eliminar" primaryTone="danger" primaryLoading>
        ¿Seguro?
      </Modal>
    );
    const primary = screen.getByRole('button', { name: /Eliminar|\.\.\./ , hidden: false });
    expect(primary).toBeDisabled();
  });

  describe('estilo Nueva Mesa (panel esmerilado)', () => {
    test('el modal usa las clases del sistema', () => {
      render(
        <Modal open title="Nueva mesa" onClose={() => {}} primaryLabel="Guardar">
          <input aria-label="Nombre" />
        </Modal>
      );
      expect(screen.getByTestId('modal-backdrop')).toHaveClass('bento-modal__backdrop');
      expect(screen.getByRole('dialog')).toHaveClass('bento-modal__panel');
      expect(screen.getByRole('heading', { name: 'Nueva mesa' })).toHaveClass('bento-modal__title');
    });

    test('tokens del modal definidos en bento.css y en BENTO_TOKENS', () => {
      for (const token of ['--bento-modal-scrim', '--bento-modal-panel-bg', '--bento-modal-radius']) {
        expect(css).toContain(`${token}:`);
        expect(BENTO_TOKENS).toHaveProperty([token]);
      }
      expect(BENTO_TOKENS['--bento-modal-radius']).toBe('2.5rem');
    });

    test('CSS: fondo desenfocado y panel translúcido con blur, esquinas de 40 px y legible', () => {
      const backdrop = ruleOf('.bento-modal__backdrop');
      expect(backdrop).toMatch(/backdrop-filter:\s*blur\(\d+px\)/);
      expect(backdrop).toContain('var(--bento-modal-scrim)');

      const panel = ruleOf('.bento-modal__panel');
      expect(panel).toMatch(/backdrop-filter:\s*blur\(\d+px\)/);
      expect(panel).toContain('border-radius: var(--bento-modal-radius)');
      expect(panel).toContain('var(--bento-modal-panel-bg)');
      expect(parseInt(panel.match(/max-width:\s*(\d+)px/)![1], 10)).toBeGreaterThanOrEqual(520);
    });

    test('CSS: título grande y ligero; campos y botones píldora anchos', () => {
      const title = ruleOf('.bento-modal__title');
      expect(title).toMatch(/font-weight:\s*300/);
      expect(parseFloat(title.match(/font-size:\s*([0-9.]+)rem/)![1])).toBeGreaterThanOrEqual(1.75);

      expect(css).toMatch(/\.bento-modal__panel input[^{]*\{[^}]*border-radius:\s*var\(--bento-pill-radius\)/);
      expect(css).toMatch(/\.bento-modal__panel select[^{]*\{[^}]*border-radius:\s*var\(--bento-pill-radius\)/);
      expect(ruleOf('.bento-modal__footer > *')).toMatch(/flex:\s*1/);
    });

    test('Button usa forma de píldora', () => {
      render(<Button>x</Button>);
      expect(screen.getByRole('button').getAttribute('style')).toContain('--bento-pill-radius');
    });
  });
});
