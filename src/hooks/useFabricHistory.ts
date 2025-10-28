'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { CanvasEvents, TPointerEvent, TPointerEventInfo, Object as FabricObject } from 'fabric';
import { useCanvas } from '@/context/canvasContext';
import { HistoryOperations } from '@/types/fabric';

export const useFabricHistory = (): HistoryOperations => {
  const { canvas, getShouldRecordHistory } = useCanvas();
  const [history, setHistory] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const isRedoing = useRef<boolean>(false);
  const isUndoing = useRef<boolean>(false);
  const isLoadingFromHistory = useRef<boolean>(false);
  const lastSavedState = useRef<string>('');

  const updateUndoRedoState = useCallback(() => {
    setCanUndo(currentIndex > 0);
    setCanRedo(currentIndex < history.length - 1);
  }, [currentIndex, history.length]);

  const makeImagesNonInteractive = useCallback(() => {
    if (!canvas) return;
    canvas.getObjects().forEach(obj => {
      if (obj.type === 'image') {
        obj.set({
          selectable: false,
          evented: false,
        });
      }
    });
  }, [canvas]);

  // Effect to update undo/redo state when history changes
  useEffect(() => {
    updateUndoRedoState();
  }, [history, updateUndoRedoState]);

  const saveState = useCallback((): void => {
    if (!canvas || isRedoing.current || isUndoing.current || !getShouldRecordHistory()) return;

    const currentState = JSON.stringify(canvas.toJSON());

    // Prevent saving duplicate states
    if (currentState === lastSavedState.current) {
      return;
    }

    // Handle first state save - use current canvas state as the initial state
    if (currentIndex === -1) {
      setHistory([currentState]);
      setCurrentIndex(0);
      lastSavedState.current = currentState;
      return; // Don't save again below
    }

    setHistory(prev => {
      // Truncate from the effective index based on current prev length
      const effectiveIndex = Math.min(Math.max(currentIndex, -1), prev.length - 1);
      const next = prev.slice(0, effectiveIndex + 1);
      next.push(currentState);

      if (next.length > 50) {
        next.shift();
        // When shifting, the new index is capped at 49
        setCurrentIndex(Math.min(49, effectiveIndex + 1));
      } else {
        setCurrentIndex(effectiveIndex + 1);
      }

      return next;
    });

    lastSavedState.current = currentState;
  }, [canvas, getShouldRecordHistory, currentIndex]);

  // Ensure we capture an initial state once when the canvas becomes available
  useEffect(() => {
    if (!canvas) return;
    // Defer to allow any initial setup to complete
    const id = setTimeout(() => {
      // Only initialize when empty
      if (currentIndex === -1) {
        saveState();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [canvas, saveState, currentIndex]);

  const undo = useCallback((): void => {
    if (currentIndex > 0 && canvas && history.length > 0) {
      isUndoing.current = true;
      isLoadingFromHistory.current = true;
      const prevState = history[currentIndex - 1];

      canvas
        .loadFromJSON(prevState)
        .then(() => {
          makeImagesNonInteractive();
          canvas.renderAll();
          setCurrentIndex(currentIndex - 1);
          lastSavedState.current = prevState;
          isUndoing.current = false;
          isLoadingFromHistory.current = false;
        })
        .catch(error => {
          console.error('Undo error:', error);
          isUndoing.current = false;
          isLoadingFromHistory.current = false;
        });
    }
  }, [canvas, history, makeImagesNonInteractive, currentIndex]);

  const redo = useCallback((): void => {
    if (currentIndex < history.length - 1 && canvas && history.length > 0) {
      isRedoing.current = true;
      isLoadingFromHistory.current = true;
      const nextState = history[currentIndex + 1];

      canvas
        .loadFromJSON(nextState)
        .then(() => {
          makeImagesNonInteractive();
          canvas.renderAll();
          setCurrentIndex(currentIndex + 1);
          lastSavedState.current = nextState;
          isRedoing.current = false;
          isLoadingFromHistory.current = false;
        })
        .catch(error => {
          console.error('Redo error:', error);
          isRedoing.current = false;
          isLoadingFromHistory.current = false;
        });
    }
  }, [canvas, history, makeImagesNonInteractive, currentIndex]);

  const clear = useCallback((): void => {
    if (!canvas) return;
    setHistory([]);
    setCurrentIndex(-1);
    lastSavedState.current = '';
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;

    // Save only on clear user-intent events to avoid loops from programmatic updates
    const events: (keyof CanvasEvents)[] = [
      'object:added',
      'object:removed',
      'mouse:up',
      'path:created',
    ];
    type SkippableObject = FabricObject & { shouldNotStoreInHistory?: boolean };
    const eventHandler = (e: TPointerEventInfo<TPointerEvent>) => {
      if (isLoadingFromHistory.current) {
        return;
      }
      const obj = e?.target as SkippableObject | undefined;
      if (obj?.shouldNotStoreInHistory) {
        return;
      }

      // Debounce saves to avoid rapid multiple entries during transforms
      setTimeout(() => {
        saveState();
      }, 10);
    };

    events.forEach(event => canvas.on(event, eventHandler));
    return () => events.forEach(event => canvas.off(event, eventHandler));
  }, [canvas, saveState]);

  return {
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
  };
};
