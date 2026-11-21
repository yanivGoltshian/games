import type { PointerEvent } from 'react';

type CardPointer = PointerEvent<HTMLButtonElement>;

function release({ currentTarget, pointerId }: CardPointer): void {
  if (currentTarget.dataset.cardPress === String(pointerId)) {
    delete currentTarget.dataset.cardPress;
  }
}

// Touch browsers can postpone :active until release. Paint contact only;
// the native click (or the drag recognizer) still owns the action.
export const cardPressFeedback = {
  onPointerDownCapture({ currentTarget, pointerId, pointerType, isPrimary, button }: CardPointer): void {
    if (!currentTarget.disabled && isPrimary && button === 0 && pointerType !== 'mouse') {
      currentTarget.dataset.cardPress = String(pointerId);
    }
  },
  onPointerUpCapture: release,
  onPointerCancelCapture: release,
  onLostPointerCapture: release,
  onPointerLeave: release,
};
