'use client';
import React, { useEffect, useRef } from 'react';
import { useCanvas } from '@/context/canvasContext';
import { CanvasProps } from '@/types/fabric';
import CanvasRuler from './CanvasRuler';

export const Canvas: React.FC<CanvasProps & { showRulers?: boolean }> = ({
  width,
  height,
  className,
  showRulers = true,
}) => {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const { initializeCanvas, canvas, disposeCanvas } = useCanvas();

  useEffect(() => {
    if (canvasElementRef.current && !canvas) {
      initializeCanvas(canvasElementRef.current, {
        width: width,
        height: height,
        backgroundColor: 'white',

        // preserveObjectStacking: true,
        // selection: true,
        // containerClass: 'canvas-container',
        // controlsAboveOverlay: true,
        // allowTouchScrolling: true,
        // viewportTransform: [1, 0, 0, 1, 0, 0]
      });
    }
    return () => {
      if (canvas) {
        disposeCanvas();
      }
    };
  }, [initializeCanvas, canvas, width, height, disposeCanvas]);

  return (
    <div className="canvas-with-rulers" style={{ position: 'relative' }}>
      {showRulers && <CanvasRuler className="absolute inset-0" />}
      <div
        style={{
          paddingTop: showRulers ? '30px' : '0px',
          paddingLeft: showRulers ? '30px' : '0px',
        }}
      >
        <canvas ref={canvasElementRef} className={className} />
      </div>
    </div>
  );
};

export default Canvas;
