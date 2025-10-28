'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvas } from '@/context/canvasContext';
import { useProjects } from '@/hooks/useProjects';
import { useParams } from 'next/navigation';
import { useRuler } from '@/context/rulerContext';

interface CanvasRulerProps {
  className?: string;
}

export const CanvasRuler: React.FC<CanvasRulerProps> = ({ className }) => {
  const horizontalRulerRef = useRef<HTMLCanvasElement>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement>(null);
  const { canvas } = useCanvas();
  const [rulerSize] = useState(30);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const { useProject } = useProjects();
  const params = useParams();
  const projectId = params.projectId as string;
  const { data: project } = useProject(projectId);
  const pixelToFeetRatio = project?.pixelToFeetRatio || null;
  const { originX, originY, resetOrigin } = useRuler();

  // Get device pixel ratio for crisp rendering
  const getDevicePixelRatio = () => {
    return window.devicePixelRatio || 1;
  };

  const drawRuler = useCallback(
    (
      canvas: HTMLCanvasElement,
      isHorizontal: boolean,
      width: number,
      height: number,
      zoom: number,
      panX: number,
      panY: number,
      mousePos?: { x: number; y: number } | null
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = getDevicePixelRatio();

      // Set canvas size accounting for device pixel ratio
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      // Scale context to account for device pixel ratio
      ctx.scale(dpr, dpr);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Set background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);

      // Set text properties for crisp rendering
      ctx.fillStyle = '#333';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw border
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

      // Multi-level tick system with more granular steps
      const baseStep = 5; // Smallest step in pixels
      const smallStep = 10; // Small step
      const mediumStep = 20; // Medium step
      const largeStep = 50; // Large step
      const majorStep = 100; // Major step with labels

      // Always show baseStep for maximum detail
      const currentStep = baseStep;

      // Helper to format pixels into feet-inches string like 12'-4"
      const formatFeetInches = (pixels: number): string => {
        if (!pixelToFeetRatio || pixelToFeetRatio <= 0) {
          return Math.round(pixels).toString();
        }
        const totalInchesFloat = (pixels / pixelToFeetRatio) * 12;
        const totalInchesRounded = Math.round(totalInchesFloat);
        const sign = totalInchesRounded < 0 ? '-' : '';
        const absInches = Math.abs(totalInchesRounded);
        const feet = Math.floor(absInches / 12);
        const inches = absInches % 12;
        return `${sign}${feet}'-${inches}\"`;
      };

      if (isHorizontal) {
        // Visible range in RELATIVE coordinates (origin-centric)
        const startRelX = -panX / zoom - originX;
        const endRelX = (width - panX) / zoom - originX;

        // First tick in relative space
        const firstRelTick = Math.floor(startRelX / currentStep) * currentStep;

        // Draw horizontal ruler in relative space
        for (let relX = firstRelTick; relX <= endRelX + currentStep; relX += currentStep) {
          const roundedRelX = Math.round(relX);
          const worldX = relX + originX;
          const screenX = worldX * zoom + panX;

          // Only draw if within visible area
          if (screenX >= -10 && screenX <= width + 10) {
            // Determine tick size based on position
            let tickHeight = 3; // Smallest tick (baseStep)
            let showLabel = false;

            if (roundedRelX % majorStep === 0) {
              tickHeight = 15; // Major tick
              showLabel = true;
            } else if (roundedRelX % largeStep === 0) {
              tickHeight = 10; // Large tick
            } else if (roundedRelX % mediumStep === 0) {
              tickHeight = 7; // Medium tick
            } else if (roundedRelX % smallStep === 0) {
              tickHeight = 5; // Small tick
            }

            // Draw tick mark
            ctx.beginPath();
            ctx.moveTo(screenX + 0.5, height);
            ctx.lineTo(screenX + 0.5, height - tickHeight);
            ctx.strokeStyle = roundedRelX % majorStep === 0 ? '#333' : '#666';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw number for labeled ticks
            if (showLabel) {
              const pixelValue = roundedRelX;
              const displayValue = formatFeetInches(pixelValue);

              ctx.fillStyle = '#333';
              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillText(displayValue, screenX, height - tickHeight - 6);
            }
          }
        }

        // Draw origin marker on horizontal ruler
        const originScreenX = originX * zoom + panX;
        if (originScreenX >= 0 && originScreenX <= width) {
          ctx.beginPath();
          ctx.moveTo(originScreenX + 0.5, height);
          ctx.lineTo(originScreenX + 0.5, 0);
          ctx.strokeStyle = '#2a6df4';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw cursor position indicator on horizontal ruler
        if (mousePos && mousePos.x >= 0 && mousePos.x <= width) {
          const screenX = mousePos.x;

          // Draw cursor line
          ctx.beginPath();
          ctx.moveTo(screenX + 0.5, 0);
          ctx.lineTo(screenX + 0.5, height);
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw cursor position value
          const worldX = (screenX - panX) / zoom;
          const pixelValue = Math.round(worldX - originX);
          const displayValue = formatFeetInches(pixelValue);

          // Background for text
          const textWidth = ctx.measureText(displayValue).width;
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(screenX - textWidth / 2 - 4, 2, textWidth + 8, 14);

          // Text
          ctx.fillStyle = 'white';
          ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(displayValue, screenX, 9);
        }
      } else {
        // Calculate the world coordinates that are visible
        const startRelY = -panY / zoom - originY;
        const endRelY = (height - panY) / zoom - originY;

        const firstRelTick = Math.floor(startRelY / currentStep) * currentStep;

        // Draw vertical ruler in relative space
        for (let relY = firstRelTick; relY <= endRelY + currentStep; relY += currentStep) {
          const roundedRelY = Math.round(relY);
          const worldY = relY + originY;
          const screenY = worldY * zoom + panY;

          // Only draw if within visible area
          if (screenY >= -10 && screenY <= height + 10) {
            // Determine tick size based on position
            let tickWidth = 3; // Smallest tick (baseStep)
            let showLabel = false;

            if (roundedRelY % majorStep === 0) {
              tickWidth = 15; // Major tick
              showLabel = true;
            } else if (roundedRelY % largeStep === 0) {
              tickWidth = 10; // Large tick
            } else if (roundedRelY % mediumStep === 0) {
              tickWidth = 7; // Medium tick
            } else if (roundedRelY % smallStep === 0) {
              tickWidth = 5; // Small tick
            }

            // Draw tick mark
            ctx.beginPath();
            ctx.moveTo(width, screenY + 0.5);
            ctx.lineTo(width - tickWidth, screenY + 0.5);
            ctx.strokeStyle = roundedRelY % majorStep === 0 ? '#333' : '#666';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw number for labeled ticks
            if (showLabel) {
              const pixelValue = roundedRelY;
              const displayValue = formatFeetInches(pixelValue);

              ctx.fillStyle = '#333';
              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

              ctx.save();
              ctx.translate(width - tickWidth - 6, screenY);
              ctx.rotate(-Math.PI / 2);
              ctx.fillText(displayValue, 0, 0);
              ctx.restore();
            }
          }
        }

        // Draw origin marker on vertical ruler
        const originScreenY = originY * zoom + panY;
        if (originScreenY >= 0 && originScreenY <= height) {
          ctx.beginPath();
          ctx.moveTo(0, originScreenY + 0.5);
          ctx.lineTo(width, originScreenY + 0.5);
          ctx.strokeStyle = '#2a6df4';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw cursor position indicator on vertical ruler
        if (mousePos && mousePos.y >= 0 && mousePos.y <= height) {
          const screenY = mousePos.y;

          // Draw cursor line
          ctx.beginPath();
          ctx.moveTo(0, screenY + 0.5);
          ctx.lineTo(width, screenY + 0.5);
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw cursor position value
          const worldY = (screenY - panY) / zoom;
          const pixelValue = Math.round(worldY - originY);
          const displayValue = formatFeetInches(pixelValue);

          // Background for text
          ctx.save();
          ctx.translate(2, screenY);
          ctx.rotate(-Math.PI / 2);

          const textWidth = ctx.measureText(displayValue).width;
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(-textWidth / 2 - 4, -7, textWidth + 8, 14);

          // Text
          ctx.fillStyle = 'white';
          ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(displayValue, 0, 0);
          ctx.restore();
        }
      }
    },
    [pixelToFeetRatio, originX, originY]
  );

  const updateRulers = useCallback(() => {
    if (!canvas || !horizontalRulerRef.current || !verticalRulerRef.current) return;

    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const panX = vpt[4];
    const panY = vpt[5];

    const canvasWidth = canvas.getWidth() || 800;
    const canvasHeight = canvas.getHeight() || 600;

    // Update horizontal ruler
    drawRuler(
      horizontalRulerRef.current,
      true,
      canvasWidth,
      rulerSize,
      zoom,
      panX,
      panY,
      mousePosition
    );

    // Update vertical ruler
    drawRuler(
      verticalRulerRef.current,
      false,
      rulerSize,
      canvasHeight,
      zoom,
      panX,
      panY,
      mousePosition
    );
  }, [canvas, rulerSize, drawRuler, mousePosition]);

  // Track mouse position
  useEffect(() => {
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvasElement = canvas.getElement();
      const rect = canvasElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePosition({ x, y });
    };

    const handleMouseLeave = () => {
      setMousePosition(null);
    };

    const canvasElement = canvas.getElement();
    canvasElement.addEventListener('mousemove', handleMouseMove);
    canvasElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvasElement.removeEventListener('mousemove', handleMouseMove);
      canvasElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;

    // Update rulers when canvas changes
    const handleCanvasChange = () => {
      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(updateRulers);
    };

    // Listen to canvas events that affect the viewport
    canvas.on('mouse:wheel', handleCanvasChange);
    canvas.on('mouse:down', handleCanvasChange);
    canvas.on('mouse:move', handleCanvasChange);
    canvas.on('mouse:up', handleCanvasChange);
    canvas.on('object:moving', handleCanvasChange);
    canvas.on('object:scaling', handleCanvasChange);
    canvas.on('object:rotating', handleCanvasChange);
    canvas.on('after:render', handleCanvasChange);
    canvas.on('path:created', handleCanvasChange);

    // Initial update
    updateRulers();

    return () => {
      canvas.off('mouse:wheel', handleCanvasChange);
      canvas.off('mouse:down', handleCanvasChange);
      canvas.off('mouse:move', handleCanvasChange);
      canvas.off('mouse:up', handleCanvasChange);
      canvas.off('object:moving', handleCanvasChange);
      canvas.off('object:scaling', handleCanvasChange);
      canvas.off('object:rotating', handleCanvasChange);
      canvas.off('after:render', handleCanvasChange);
      canvas.off('path:created', handleCanvasChange);
    };
  }, [canvas, pixelToFeetRatio, updateRulers]);

  // Re-render rulers when origin changes
  useEffect(() => {
    updateRulers();
  }, [originX, originY, updateRulers]);

  return (
    <div
      className={`canvas-ruler-container ${className || ''}`}
      style={{ position: 'relative', pointerEvents: 'none' }}
    >
      {/* Corner piece */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: rulerSize,
          height: rulerSize,
          backgroundColor: '#f5f5f5',
          borderRight: '1px solid #ddd',
          borderBottom: '1px solid #ddd',
          zIndex: 10,
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
        onDoubleClick={resetOrigin}
      />

      {/* Horizontal ruler */}
      <canvas
        ref={horizontalRulerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: rulerSize,
          width: '100%',
          height: rulerSize,
          zIndex: 5,
          imageRendering: 'crisp-edges',
          pointerEvents: 'none',
        }}
      />

      {/* Vertical ruler */}
      <canvas
        ref={verticalRulerRef}
        style={{
          position: 'absolute',
          top: rulerSize,
          left: 0,
          width: rulerSize,
          height: '100%',
          zIndex: 5,
          imageRendering: 'crisp-edges',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default CanvasRuler;

// 'use client';
// import React, { useCallback, useEffect, useRef, useState } from 'react';
// import { useCanvas } from '@/context/canvasContext';
// import { useSelector } from 'react-redux';
// import { RootState } from '@/types/redux';

// interface CanvasRulerProps {
//   className?: string;
// }

// export const CanvasRuler: React.FC<CanvasRulerProps> = ({ className }) => {
//   const horizontalRulerRef = useRef<HTMLCanvasElement>(null);
//   const verticalRulerRef = useRef<HTMLCanvasElement>(null);
//   const { canvas } = useCanvas();
//   const [rulerSize] = useState(30);
//   const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
//   const pixelToFeetRatio = useSelector((state: RootState) => state.canvasReducer.pixelToFeetRatio);

//   // Get device pixel ratio for crisp rendering
//   const getDevicePixelRatio = () => {
//     return window.devicePixelRatio || 1;
//   };

//   const drawRuler = useCallback(
//     (
//       canvas: HTMLCanvasElement,
//       isHorizontal: boolean,
//       width: number,
//       height: number,
//       zoom: number,
//       panX: number,
//       panY: number,
//       mousePos?: { x: number; y: number } | null
//     ) => {
//       const ctx = canvas.getContext('2d');
//       if (!ctx) return;

//       const dpr = getDevicePixelRatio();

//       // Set canvas size accounting for device pixel ratio
//       canvas.width = width * dpr;
//       canvas.height = height * dpr;
//       canvas.style.width = width + 'px';
//       canvas.style.height = height + 'px';

//       // Scale context to account for device pixel ratio
//       ctx.scale(dpr, dpr);

//       // Clear canvas
//       ctx.clearRect(0, 0, width, height);

//       // Set background
//       ctx.fillStyle = '#f5f5f5';
//       ctx.fillRect(0, 0, width, height);

//       // Set text properties for crisp rendering
//       ctx.fillStyle = '#333';
//       ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
//       ctx.textAlign = 'center';
//       ctx.textBaseline = 'middle';

//       // Draw border
//       ctx.strokeStyle = '#ddd';
//       ctx.lineWidth = 1;
//       ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

//       // Multi-level tick system with more granular steps
//       const baseStep = 5; // Smallest step in pixels
//       const smallStep = 10; // Small step
//       const mediumStep = 20; // Medium step
//       const largeStep = 50; // Large step
//       const majorStep = 100; // Major step with labels

//       // Always show baseStep for maximum detail
//       const currentStep = baseStep;

//       if (isHorizontal) {
//         // Calculate the world coordinates that are visible
//         const startWorldX = -panX / zoom;
//         const endWorldX = (width - panX) / zoom;

//         // Find the first tick mark position in world coordinates
//         const firstTick = Math.floor(startWorldX / currentStep) * currentStep;

//         // Draw horizontal ruler
//         for (let worldX = firstTick; worldX <= endWorldX + currentStep; worldX += currentStep) {
//           // Convert world coordinates to screen coordinates
//           const screenX = worldX * zoom + panX;

//           // Only draw if within visible area
//           if (screenX >= -10 && screenX <= width + 10) {
//             // Determine tick size based on position
//             let tickHeight = 3; // Smallest tick (baseStep)
//             let showLabel = false;

//             if (worldX % majorStep === 0) {
//               tickHeight = 15; // Major tick
//               showLabel = true;
//             } else if (worldX % largeStep === 0) {
//               tickHeight = 10; // Large tick
//             } else if (worldX % mediumStep === 0) {
//               tickHeight = 7; // Medium tick
//             } else if (worldX % smallStep === 0) {
//               tickHeight = 5; // Small tick
//             }

//             // Draw tick mark
//             ctx.beginPath();
//             ctx.moveTo(screenX + 0.5, height);
//             ctx.lineTo(screenX + 0.5, height - tickHeight);
//             ctx.strokeStyle = worldX % majorStep === 0 ? '#333' : '#666';
//             ctx.lineWidth = 1;
//             ctx.stroke();

//             // Draw number for labeled ticks
//             if (showLabel) {
//               const pixelValue = Math.round(worldX);
//               let displayValue: string;

//               if (pixelToFeetRatio && pixelToFeetRatio > 0) {
//                 // Convert pixels to feet
//                 const feetValue = pixelValue / pixelToFeetRatio;
//                 if (feetValue >= 1) {
//                   displayValue = feetValue.toFixed(1) + "'";
//                 } else {
//                   // Show inches for small values
//                   const inchValue = feetValue * 12;
//                   displayValue = inchValue.toFixed(1) + '"';
//                 }
//               } else {
//                 // Show pixels if no ratio is set
//                 displayValue = pixelValue.toString();
//               }

//               ctx.fillStyle = '#333';
//               ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
//               ctx.fillText(displayValue, screenX, height - tickHeight - 6);
//             }
//           }
//         }

//         // Draw cursor position indicator on horizontal ruler
//         if (mousePos && mousePos.x >= 0 && mousePos.x <= width) {
//           const screenX = mousePos.x;

//           // Draw cursor line
//           ctx.beginPath();
//           ctx.moveTo(screenX + 0.5, 0);
//           ctx.lineTo(screenX + 0.5, height);
//           ctx.strokeStyle = '#ff4444';
//           ctx.lineWidth = 2;
//           ctx.stroke();

//           // Draw cursor position value
//           const worldX = (screenX - panX) / zoom;
//           const pixelValue = Math.round(worldX);
//           let displayValue: string;

//           if (pixelToFeetRatio && pixelToFeetRatio > 0) {
//             const feetValue = pixelValue / pixelToFeetRatio;
//             if (feetValue >= 1) {
//               displayValue = feetValue.toFixed(1) + "'";
//             } else {
//               const inchValue = feetValue * 12;
//               displayValue = inchValue.toFixed(1) + '"';
//             }
//           } else {
//             displayValue = pixelValue.toString();
//           }

//           // Background for text
//           const textWidth = ctx.measureText(displayValue).width;
//           ctx.fillStyle = '#ff4444';
//           ctx.fillRect(screenX - textWidth / 2 - 4, 2, textWidth + 8, 14);

//           // Text
//           ctx.fillStyle = 'white';
//           ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
//           ctx.fillText(displayValue, screenX, 9);
//         }
//       } else {
//         // Calculate the world coordinates that are visible
//         const startWorldY = -panY / zoom;
//         const endWorldY = (height - panY) / zoom;

//         // Find the first tick mark position in world coordinates
//         const firstTick = Math.floor(startWorldY / currentStep) * currentStep;

//         // Draw vertical ruler
//         for (let worldY = firstTick; worldY <= endWorldY + currentStep; worldY += currentStep) {
//           // Convert world coordinates to screen coordinates
//           const screenY = worldY * zoom + panY;

//           // Only draw if within visible area
//           if (screenY >= -10 && screenY <= height + 10) {
//             // Determine tick size based on position
//             let tickWidth = 3; // Smallest tick (baseStep)
//             let showLabel = false;

//             if (worldY % majorStep === 0) {
//               tickWidth = 15; // Major tick
//               showLabel = true;
//             } else if (worldY % largeStep === 0) {
//               tickWidth = 10; // Large tick
//             } else if (worldY % mediumStep === 0) {
//               tickWidth = 7; // Medium tick
//             } else if (worldY % smallStep === 0) {
//               tickWidth = 5; // Small tick
//             }

//             // Draw tick mark
//             ctx.beginPath();
//             ctx.moveTo(width, screenY + 0.5);
//             ctx.lineTo(width - tickWidth, screenY + 0.5);
//             ctx.strokeStyle = worldY % majorStep === 0 ? '#333' : '#666';
//             ctx.lineWidth = 1;
//             ctx.stroke();

//             // Draw number for labeled ticks
//             if (showLabel) {
//               const pixelValue = Math.round(worldY);
//               let displayValue: string;

//               if (pixelToFeetRatio && pixelToFeetRatio > 0) {
//                 // Convert pixels to feet
//                 const feetValue = pixelValue / pixelToFeetRatio;
//                 if (feetValue >= 1) {
//                   displayValue = feetValue.toFixed(1) + "'";
//                 } else {
//                   // Show inches for small values
//                   const inchValue = feetValue * 12;
//                   displayValue = inchValue.toFixed(1) + '"';
//                 }
//               } else {
//                 // Show pixels if no ratio is set
//                 displayValue = pixelValue.toString();
//               }

//               ctx.fillStyle = '#333';
//               ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

//               ctx.save();
//               ctx.translate(width - tickWidth - 12, screenY);
//               ctx.rotate(-Math.PI / 2);
//               ctx.fillText(displayValue, 0, 0);
//               ctx.restore();
//             }
//           }
//         }

//         // Draw cursor position indicator on vertical ruler
//         if (mousePos && mousePos.y >= 0 && mousePos.y <= height) {
//           const screenY = mousePos.y;

//           // Draw cursor line
//           ctx.beginPath();
//           ctx.moveTo(0, screenY + 0.5);
//           ctx.lineTo(width, screenY + 0.5);
//           ctx.strokeStyle = '#ff4444';
//           ctx.lineWidth = 2;
//           ctx.stroke();

//           // Draw cursor position value
//           const worldY = (screenY - panY) / zoom;
//           const pixelValue = Math.round(worldY);
//           let displayValue: string;

//           if (pixelToFeetRatio && pixelToFeetRatio > 0) {
//             const feetValue = pixelValue / pixelToFeetRatio;
//             if (feetValue >= 1) {
//               displayValue = feetValue.toFixed(1) + "'";
//             } else {
//               const inchValue = feetValue * 12;
//               displayValue = inchValue.toFixed(1) + '"';
//             }
//           } else {
//             displayValue = pixelValue.toString();
//           }

//           // Background for text
//           ctx.save();
//           ctx.translate(8, screenY);
//           ctx.rotate(-Math.PI / 2);

//           const textWidth = ctx.measureText(displayValue).width;
//           ctx.fillStyle = '#ff4444';
//           ctx.fillRect(-textWidth / 2 - 4, -7, textWidth + 8, 14);

//           // Text
//           ctx.fillStyle = 'white';
//           ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
//           ctx.fillText(displayValue, 0, 0);
//           ctx.restore();
//         }
//       }
//     },
//     [pixelToFeetRatio]
//   );

//   const updateRulers = useCallback(() => {
//     if (!canvas || !horizontalRulerRef.current || !verticalRulerRef.current) return;

//     const zoom = canvas.getZoom();
//     const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
//     const panX = vpt[4];
//     const panY = vpt[5];

//     const canvasWidth = canvas.getWidth() || 800;
//     const canvasHeight = canvas.getHeight() || 600;

//     // Update horizontal ruler
//     drawRuler(
//       horizontalRulerRef.current,
//       true,
//       canvasWidth,
//       rulerSize,
//       zoom,
//       panX,
//       panY,
//       mousePosition
//     );

//     // Update vertical ruler
//     drawRuler(
//       verticalRulerRef.current,
//       false,
//       rulerSize,
//       canvasHeight,
//       zoom,
//       panX,
//       panY,
//       mousePosition
//     );
//   }, [canvas, rulerSize, drawRuler, mousePosition]);

//   // Track mouse position
//   useEffect(() => {
//     if (!canvas) return;

//     const handleMouseMove = (e: any) => {
//       // Get pointer position relative to the canvas
//       const pointer = canvas.getPointer(e.e);
//       // Convert to screen coordinates
//       const zoom = canvas.getZoom();
//       const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
//       const panX = vpt[4];
//       const panY = vpt[5];

//       const screenX = pointer.x * zoom + panX;
//       const screenY = pointer.y * zoom + panY;

//       setMousePosition({ x: screenX, y: screenY });
//     };

//     const handleMouseOut = () => {
//       setMousePosition(null);
//     };

//     // Listen to canvas mouse events
//     canvas.on('mouse:move', handleMouseMove);
//     canvas.on('mouse:out', handleMouseOut);

//     return () => {
//       canvas.off('mouse:move', handleMouseMove);
//       canvas.off('mouse:out', handleMouseOut);
//     };
//   }, [canvas]);

//   useEffect(() => {
//     if (!canvas) return;

//     // Update rulers when canvas changes
//     const handleCanvasChange = () => {
//       // Use requestAnimationFrame for smooth updates
//       requestAnimationFrame(updateRulers);
//     };

//     // Listen to canvas events that affect the viewport
//     canvas.on('mouse:wheel', handleCanvasChange);
//     canvas.on('mouse:down', handleCanvasChange);
//     canvas.on('mouse:move', handleCanvasChange);
//     canvas.on('mouse:up', handleCanvasChange);
//     canvas.on('object:moving', handleCanvasChange);
//     canvas.on('object:scaling', handleCanvasChange);
//     canvas.on('object:rotating', handleCanvasChange);
//     canvas.on('after:render', handleCanvasChange);
//     canvas.on('path:created', handleCanvasChange);

//     // Initial update
//     updateRulers();

//     return () => {
//       canvas.off('mouse:wheel', handleCanvasChange);
//       canvas.off('mouse:down', handleCanvasChange);
//       canvas.off('mouse:move', handleCanvasChange);
//       canvas.off('mouse:up', handleCanvasChange);
//       canvas.off('object:moving', handleCanvasChange);
//       canvas.off('object:scaling', handleCanvasChange);
//       canvas.off('object:rotating', handleCanvasChange);
//       canvas.off('after:render', handleCanvasChange);
//       canvas.off('path:created', handleCanvasChange);
//     };
//   }, [canvas, pixelToFeetRatio, updateRulers]);

//   return (
//     <div className={`canvas-ruler-container ${className || ''}`} style={{ position: 'relative' }}>
//       {/* Corner piece */}
//       <div
//         style={{
//           position: 'absolute',
//           top: 0,
//           left: 0,
//           width: rulerSize,
//           height: rulerSize,
//           backgroundColor: '#f5f5f5',
//           borderRight: '1px solid #ddd',
//           borderBottom: '1px solid #ddd',
//           zIndex: 10,
//         }}
//       />

//       {/* Horizontal ruler */}
//       <canvas
//         ref={horizontalRulerRef}
//         style={{
//           position: 'absolute',
//           top: 0,
//           left: rulerSize,
//           width: '100%',
//           height: rulerSize,
//           zIndex: 5,
//           imageRendering: 'crisp-edges',
//         }}
//       />

//       {/* Vertical ruler */}
//       <canvas
//         ref={verticalRulerRef}
//         style={{
//           position: 'absolute',
//           top: rulerSize,
//           left: 0,
//           width: rulerSize,
//           height: '100%',
//           zIndex: 5,
//           imageRendering: 'crisp-edges',
//         }}
//       />
//     </div>
//   );
// };

// export default CanvasRuler;
