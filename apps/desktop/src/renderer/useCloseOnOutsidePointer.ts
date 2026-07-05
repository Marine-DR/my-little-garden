import { useEffect, type RefObject } from 'react';

export function useCloseOnOutsidePointer(
  container: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const closeWhenOutside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        close();
      }
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    return () => document.removeEventListener('pointerdown', closeWhenOutside);
  }, [close, container, open]);
}
