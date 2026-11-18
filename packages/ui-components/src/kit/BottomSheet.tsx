import React, { forwardRef } from 'react';
import { motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion';

export interface BottomSheetProps extends Omit<React.ComponentProps<typeof motion.div>, 'onDragEnd' | 'children'> {
  children?: React.ReactNode;
  onDismiss: () => void;
}

export function shouldDismissSheet(offsetY: number, velocityY: number): boolean {
  return offsetY > 100 || velocityY > 500;
}

export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(function BottomSheet(
  { onDismiss, children, ...props }, ref,
) {
  const reducedMotion = useReducedMotion();
  const controls = useDragControls();
  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (shouldDismissSheet(info.offset.y, info.velocity.y)) onDismiss();
  };
  return (
    <motion.div
      {...props}
      ref={ref}
      layout
      initial={reducedMotion ? false : { y: '100%' }}
      animate={{ y: 0 }}
      exit={reducedMotion ? undefined : { y: '100%' }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      onDragEnd={onDragEnd}
    >
      <div data-testid="bottom-sheet-handle" aria-hidden="true" onPointerDown={(event) => controls.start(event)} style={{ touchAction: 'none', cursor: 'grab', padding: '4px 0 16px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--bento-border)', margin: 'auto' }} />
      </div>
      {children}
    </motion.div>
  );
});
