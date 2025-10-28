'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SidebarInset } from '@/components/ui/Sidebar';
import Canvas from '@/components/canvas/Canvas';
import CanvasSidebar from '@/components/CanvasSidebar';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useCanvas } from '@/context/canvasContext';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/types/redux';
import { setPixelToFeetRatio } from '@/store/slices/canvasSlice';
import { FabricImage, FabricText, Polygon } from 'fabric';
import * as fabric from 'fabric';
import { FloorPlanSegmentationResponse } from '@/types/interfaces';
import AIAnalysisDialog from '@/components/dialogs/AiAnalysisDialog';
import { setFile } from '@/store/slices/fileSlice';
import { useProjects } from '@/hooks/useProjects';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useIdentification } from '@/hooks/useIdentification';
import { assignCategory } from '@/lib/utils';
import { ComponentType } from '@/utils/enum';
import CanvasLoader from '@/components/skeletons/CanvasLoader';
import { useRuler } from '@/context/rulerContext';
import ReferenceLineDialog from '@/components/dialogs/ReferenceLineDialog';

const DashboardScreen = () => {
  const { width, height } = useWindowSize();
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvas, isReady, setShouldRecordHistory, setInitialCanvas } = useCanvas();
  const { file } = useSelector((state: RootState) => state.fileReducer);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const dispatch = useDispatch();
  const { showRulers } = useRuler();
  const { updateProject, useProject } = useProjects();
  const params = useParams();
  const projectId = params.projectId as string;
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { segmentFloorPlan, analyzeRoom } = useIdentification();

  // Auto-save functionality
  const handleAutoSave = useCallback(async () => {
    if (!canvas || !projectId) return;

    try {
      // Prevent saving transient hover highlight: restore original fills temporarily
      const HIGHLIGHT_FILL = 'rgba(59, 130, 246, 0.3)';
      type HoveredPoly = { obj: fabric.Object; originalFill: string | null | undefined };
      const hoveredPolygons: HoveredPoly[] = [];
      canvas.getObjects().forEach(obj => {
        if (obj.type === 'polygon') {
          const originalFill = obj.get('originalFill');
          if (originalFill !== undefined) {
            // Currently hovered: fill is highlight, 'originalFill' holds real fill
            hoveredPolygons.push({ obj, originalFill });
            obj.set('fill', originalFill);
          }
        }
      });

      const canvasData = canvas.toJSON();
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1.0,
        multiplier: 1,
      });

      const jsonData = JSON.stringify(canvasData);
      setInitialCanvas(jsonData);

      await updateProject({
        id: projectId,
        data: {
          thumbnail: dataURL,
          data: jsonData,
          canvasWidth: canvas.getWidth(),
          canvasHeight: canvas.getHeight(),
        },
      });
      canvas.renderAll();

      // Re-apply hover highlight to preserve UI state after save
      if (hoveredPolygons.length > 0) {
        hoveredPolygons.forEach(({ obj, originalFill }) => {
          obj.set('fill', HIGHLIGHT_FILL);
          obj.set('originalFill', originalFill);
        });
        canvas.requestRenderAll();
      }

      console.log('Auto-save completed successfully');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [canvas, projectId, updateProject, setInitialCanvas]);

  // Set up auto-save interval (5 minutes = 300000 milliseconds)
  useEffect(() => {
    if (!isReady || !projectId) return;

    const autoSaveInterval = setInterval(() => {
      handleAutoSave();
    }, 1800000); // 30 minutes

    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [isReady, projectId, handleAutoSave]);

  const basePixelToFeetRatioRef = useRef<number | null>(null);
  const runtimePixelToFeetRatio = useSelector(
    (state: RootState) => state.canvasReducer.pixelToFeetRatio
  );

  useEffect(() => {
    // Keep base ratio consistent with runtime ratio divided by last applied uniform scale
    if (runtimePixelToFeetRatio && lastUniformScaleRef.current) {
      basePixelToFeetRatioRef.current = runtimePixelToFeetRatio / lastUniformScaleRef.current;
    } else if (project && basePixelToFeetRatioRef.current === null) {
      basePixelToFeetRatioRef.current = project.pixelToFeetRatio ?? null;
    }
  }, [runtimePixelToFeetRatio, project]);

  const lastUniformScaleRef = useRef<number>(1);
  const lastOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Scale and center all content to fit the canvas at 100% zoom
  const fitContentToCanvas = useCallback(
    (paddingRatio: number = 0.9) => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      if (objects.length === 0) return;

      // Compute content bounding box
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      objects.forEach(obj => {
        const rect = obj.getBoundingRect();
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.left + rect.width);
        maxY = Math.max(maxY, rect.top + rect.height);
      });
      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      const canvasW = canvas.getWidth();
      const canvasH = canvas.getHeight();

      // Target size with padding
      const targetW = canvasW * paddingRatio;
      const targetH = canvasH * paddingRatio;
      const scale = Math.min(targetW / contentW, targetH / contentH);

      // Content center
      const cx = minX + contentW / 2;
      const cy = minY + contentH / 2;

      // Apply uniform scale around content center and re-center to canvas
      objects.forEach(obj => {
        const center = obj.getCenterPoint();
        const dx = center.x - cx;
        const dy = center.y - cy;
        const newCenterX = canvasW / 2 + dx * scale;
        const newCenterY = canvasH / 2 + dy * scale;
        obj.set({
          scaleX: (obj.scaleX || 1) * scale,
          scaleY: (obj.scaleY || 1) * scale,
        });
        obj.setPositionByOrigin(new fabric.Point(newCenterX, newCenterY), 'center', 'center');
        obj.setCoords();
      });
      canvas.renderAll();

      // Update scaling context for subsequent resizes
      lastUniformScaleRef.current = (lastUniformScaleRef.current || 1) * scale;
      lastOffsetRef.current = {
        x: (canvasW - contentW * scale) / 2,
        y: (canvasH - contentH * scale) / 2,
      };
    },
    [canvas]
  );

  const adjustCanvasSize = useCallback(() => {
    if (containerRef.current && canvas) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // Account for ruler space (30px on top and left) if rulers are shown
      const rulerSpace = showRulers ? 30 : 0;
      const canvasWidth = Math.floor(containerWidth - rulerSpace);
      const canvasHeight = Math.floor(containerHeight - rulerSpace);
      // Calculate scale factors
      const scaleX =
        project === undefined
          ? 1
          : project?.canvasWidth === 0
            ? 1
            : canvasWidth / project?.canvasWidth;
      const scaleY =
        project === undefined
          ? 1
          : project?.canvasHeight === 0
            ? 1
            : canvasHeight / project?.canvasHeight;

      // Use uniform scale to maintain aspect ratio
      const uniformScale = Math.min(scaleX, scaleY);

      // Calculate centering offsets
      const originalCanvasWidth = project?.canvasWidth || canvasWidth;
      const originalCanvasHeight = project?.canvasHeight || canvasHeight;

      const scaledContentWidth = originalCanvasWidth * uniformScale;
      const scaledContentHeight = originalCanvasHeight * uniformScale;

      const offsetX = (canvasWidth - scaledContentWidth) / 2;
      const offsetY = (canvasHeight - scaledContentHeight) / 2;

      // Set new canvas dimensions
      canvas.setDimensions({ width: canvasWidth, height: canvasHeight });

      // Scale all objects relative to the last applied scale/offset (delta-based)
      const deltaScale = uniformScale / (lastUniformScaleRef.current || 1);
      const prevOffset = lastOffsetRef.current;

      canvas.getObjects().forEach(obj => {
        const currentScaleX = obj.scaleX || 1;
        const currentScaleY = obj.scaleY || 1;

        const newLeft = (obj.left - prevOffset.x) * deltaScale + offsetX;
        const newTop = (obj.top - prevOffset.y) * deltaScale + offsetY;
        const newScaleX = currentScaleX * deltaScale;
        const newScaleY = currentScaleY * deltaScale;

        obj.set({ left: newLeft, top: newTop, scaleX: newScaleX, scaleY: newScaleY });

        if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
          const currentFont = obj.get('fontSize') || 16;
          obj.set({ fontSize: currentFont * deltaScale });
        }

        obj.setCoords();
      });

      canvas.renderAll();

      // Persist new scale context for next resize pass
      lastUniformScaleRef.current = uniformScale;
      lastOffsetRef.current = { x: offsetX, y: offsetY };

      // Update runtime pixel-to-feet ratio so rulers/exports remain consistent after scaling
      const baseRatio =
        basePixelToFeetRatioRef.current ?? project?.pixelToFeetRatio ?? runtimePixelToFeetRatio;
      if (typeof baseRatio === 'number' && baseRatio > 0) {
        dispatch(setPixelToFeetRatio(baseRatio * uniformScale));
      }
    }
  }, [canvas, project, showRulers, dispatch, runtimePixelToFeetRatio]);
  useEffect(() => {
    if (isReady) {
      adjustCanvasSize();
    }
  }, [isReady, height, width, adjustCanvasSize, project]);

  const loadImageFromRedux = useCallback(async () => {
    setIsAnalyzing(true);
    const imageElement: HTMLImageElement = document.createElement('img');
    imageElement.src = file!;

    imageElement.onload = async function () {
      setShouldRecordHistory(false);
      const img = new FabricImage(imageElement);
      const canvasWidth = canvas!.getWidth();
      const canvasHeight = canvas!.getHeight();

      const scaleX = canvasWidth / img.width;
      const scaleY = canvasHeight / img.height;
      const scaleToFit = Math.min(scaleX, scaleY);

      img.set({
        scaleX: scaleToFit,
        scaleY: scaleToFit,
        selectable: false,
        evented: false,
        left: (canvasWidth - img.width * scaleToFit) / 2,
        top: (canvasHeight - img.height * scaleToFit) / 2,
      });

      canvas!.add(img);

      // Store the scale factor and image position for polygon transformation
      const imageData = {
        scale: scaleToFit,
        left: (canvasWidth - img.width * scaleToFit) / 2,
        top: (canvasHeight - img.height * scaleToFit) / 2,
      };

      // Process the segmentation results
      try {
        const result: FloorPlanSegmentationResponse = await segmentFloorPlan(file!);

        for (const prediction of result.predictions) {
          // Transform points according to the scaled image
          const transformedPoints = prediction.points.map(point => ({
            x: point.x * imageData.scale + imageData.left,
            y: point.y * imageData.scale + imageData.top,
          }));

          // Helper function to crop region from original image
          const cropRegionFromImage = async (
            imgEl: HTMLImageElement,
            points: typeof transformedPoints
          ): Promise<string | null> => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) return null;

              // Find bounding box of the polygon in canvas coordinates
              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
              points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
              });

              // Calculate bounds in original image coordinates
              // Reverse the scaling transformation
              const origMinX = (minX - imageData.left) / imageData.scale;
              const origMinY = (minY - imageData.top) / imageData.scale;
              const origMaxX = (maxX - imageData.left) / imageData.scale;
              const origMaxY = (maxY - imageData.top) / imageData.scale;

              const width = origMaxX - origMinX;
              const height = origMaxY - origMinY;
              canvas.width = width;
              canvas.height = height;

              // Adjust points to be relative to the crop area in original coordinates
              const adjustedPoints = points.map(p => ({
                x: (p.x - imageData.left) / imageData.scale - origMinX,
                y: (p.y - imageData.top) / imageData.scale - origMinY,
              }));

              // Create a clipping path and draw the region
              ctx.beginPath();
              ctx.moveTo(adjustedPoints[0].x, adjustedPoints[0].y);
              for (let i = 1; i < adjustedPoints.length; i++) {
                ctx.lineTo(adjustedPoints[i].x, adjustedPoints[i].y);
              }
              ctx.closePath();
              ctx.clip();

              // Draw the image in the clipping area using original image coordinates
              ctx.drawImage(
                imgEl,
                origMinX,
                origMinY,
                width,
                height, // source rectangle
                0,
                0,
                width,
                height // destination rectangle
              );

              return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]; // Return base64 without data URL prefix
            } catch (error) {
              console.error('Error cropping region:', error);
              return null;
            }
          };

          // Default room label from prediction
          let roomLabel = prediction.class === 'toilet' ? 'Bathroom' : prediction.class;
          let roomFeatures = '';

          // Try to analyze the room with AI
          try {
            const croppedBase64 = await cropRegionFromImage(imageElement, transformedPoints);
            if (croppedBase64) {
              console.log('🤖 Calling analyzeRoom API...');
              const analysis = await analyzeRoom(croppedBase64);
              console.log('✅ Room analysis result:', analysis);
              roomLabel = analysis.roomType || roomLabel;
              roomFeatures = analysis.features || '';
              console.log('📝 Final room data:', { roomLabel, roomFeatures });
            }
          } catch (error) {
            console.error('❌ Error analyzing room:', error);
            // Continue with default label if analysis fails
          }

          const polygon = new Polygon(transformedPoints, {
            fill: null,
            stroke: '#CDE4EF',
            strokeWidth: 4,
          });
          polygon?.set('name', roomLabel);
          polygon?.set('roomName', roomLabel);
          polygon?.set('features', roomFeatures); // Store features for sidebar
          polygon?.set('shapeId', 10); // Polygon shape ID from sidebar
          assignCategory(polygon, ComponentType.Shape);
          canvas!.add(polygon);

          console.log('🏠 Created polygon with features:', {
            roomLabel,
            roomFeatures,
            polygonId: polygon.get('id'),
            storedFeatures: polygon.get('features'),
          });

          // Add text label for the room class
          const text = new FabricText(roomLabel, {
            left: prediction.x * imageData.scale + imageData.left,
            top: prediction.y * imageData.scale + imageData.top,
            fontSize: 16,
            fill: '#000000',
            fontFamily: 'Arial',
            backgroundColor: 'rgba(255, 255, 255, 1)',
            padding: 5,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          text?.set('name', 'Text');
          canvas!.add(text);
        }

        // Save the canvas state to the project
        if (projectId) {
          const canvasData = canvas!.toJSON();
          const dataURL = canvas!.toDataURL({
            format: 'png', // or 'jpeg'
            quality: 1.0, // for jpeg quality (0-1)
            multiplier: 1, // scale factor
          });
          await updateProject({
            id: projectId,
            data: {
              thumbnail: dataURL,
              data: JSON.stringify(canvasData),
              canvasWidth: canvas!.getWidth(),
              canvasHeight: canvas!.getHeight(),
            },
          });
        }

        // After initial content is created, ensure it fills the canvas nicely at 100%
        fitContentToCanvas(0.9);
        setInitialCanvas(JSON.stringify(canvas?.toJSON()));
        setShouldRecordHistory(true);
      } catch (error) {
        console.error(error);
      } finally {
        setIsAnalyzing(false);
        dispatch(setFile(''));
        setIsReferenceDialogOpen(true);
      }
    };
  }, [
    setIsAnalyzing,
    file,
    canvas,
    dispatch,
    setInitialCanvas,
    setShouldRecordHistory,
    projectId,
    updateProject,
    segmentFloorPlan,
    fitContentToCanvas,
    analyzeRoom,
  ]);

  useEffect(() => {
    if (isReady && file) {
      loadImageFromRedux();
    }
  }, [canvas, isReady, file, loadImageFromRedux]);

  // // Load saved canvas state if project has data

  const loadImageFromData = useCallback(() => {
    try {
      const canvasData = JSON.parse(project!.data!);
      setShouldRecordHistory(false);
      canvas?.clear();
      canvas!.loadFromJSON(canvasData).then(() => {
        canvas!.getObjects().forEach(obj => {
          if (
            obj.type === 'image' ||
            obj.type === 'text' ||
            obj.type === 'i-text' ||
            obj.type === 'textbox'
          ) {
            obj.set({
              selectable: false,
              evented: false,
            });
          }
        });
        // After loading existing project, auto-fit only if content looks too small
        const objects = canvas!.getObjects();
        if (objects.length > 0) {
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          objects.forEach(obj => {
            const rect = obj.getBoundingRect();
            minX = Math.min(minX, rect.left);
            minY = Math.min(minY, rect.top);
            maxX = Math.max(maxX, rect.left + rect.width);
            maxY = Math.max(maxY, rect.top + rect.height);
          });
          const contentW = Math.max(1, maxX - minX);
          const contentH = Math.max(1, maxY - minY);
          const canvasW = canvas!.getWidth();
          const canvasH = canvas!.getHeight();
          if (contentW < canvasW * 0.6 && contentH < canvasH * 0.6) {
            fitContentToCanvas(0.9);
          } else {
            adjustCanvasSize();
          }
        } else {
          adjustCanvasSize();
        }
        setInitialCanvas(JSON.stringify(canvas?.toJSON()));
        setShouldRecordHistory(true);

        // Trigger export ID generation after loading to ensure component numbers are visible
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('regenerateExportIds'));
        }, 100);
      });
    } catch (error) {
      console.error('Error loading canvas state:', error);
      toast.error('Failed to load saved project state');
    }
  }, [
    canvas,
    project,
    setInitialCanvas,
    setShouldRecordHistory,
    adjustCanvasSize,
    fitContentToCanvas,
  ]);
  useEffect(() => {
    if (isReady && project?.data) {
      loadImageFromData();
    }
  }, [isReady, project, loadImageFromData]);

  if (isProjectLoading) {
    return <CanvasLoader />;
  }
  return (
    <>
      <SidebarInset className="h-[calc(100vh-88px)] overflow-hidden ml-6 mr-2 bg-[#F7F7F7]">
        <div ref={containerRef} className="h-full w-full flex justify-center items-center p-8">
          <div className="canvas-container" style={{ position: 'relative' }}>
            <Canvas className="rounded-[12px] border border-light-gray" showRulers={showRulers} />
          </div>
        </div>
        <AIAnalysisDialog isOpen={isAnalyzing} onClose={() => setIsAnalyzing(false)} />

        <ReferenceLineDialog
          isOpen={isReferenceDialogOpen}
          onClose={() => setIsReferenceDialogOpen(false)}
          setShouldRecordHistory={setShouldRecordHistory}
        />
      </SidebarInset>
      <div className="mr-4 flex-shrink-0 h-[calc(100vh-88px)]">
        <CanvasSidebar />
      </div>
    </>
  );
};

export default DashboardScreen;
