'use client';
import sidebar from '@/@data/sidebar';
import * as React from 'react';
import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/Sidebar';
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@/components/ui/Sidebar';
import { useFabricShapes } from '@/hooks/useFabricOperations';
import { useCanvas } from '@/context/canvasContext';
import * as fabric from 'fabric';
import LineLengthDialog from '@/components/dialogs/LineLengthDialog';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/useProjects';
import { useParams } from 'next/navigation';
import AppSidebarSkeleton from '@/components/skeletons/AppSidebarSkeleton';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SidebarElements } from '@/types/interfaces';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/types/redux';
import { useRuler } from '@/context/rulerContext';
import { clearShapeSizes, setPixelToFeetRatio } from '@/store/slices/canvasSlice';

// Custom hook to calculate optimal card height
const useOptimalCardHeight = (isExpanded: boolean, itemCount: number) => {
  const [cardHeight, setCardHeight] = useState<number>(80); // Default min height
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateHeight = () => {
      if (!contentRef.current || !headerRef.current) return;

      const headerElement = headerRef.current;

      // Get available height (viewport height minus some buffer for other UI elements)
      const viewportHeight = window.innerHeight;
      const availableHeight = Math.min(viewportHeight - 120, 800); // Max height of 800px, buffer of 120px

      // Calculate header height
      const headerHeight = headerElement.offsetHeight;

      // Calculate available space for content
      const contentAvailableHeight = availableHeight - headerHeight;

      // Calculate grid properties
      const gap = isExpanded ? 8 : 4; // gap-2 = 8px, gap-1 = 4px
      const padding = isExpanded ? 24 : 8; // p-3 = 24px, p-1 = 8px
      const rows = isExpanded ? Math.ceil(itemCount / 2) : itemCount;

      // Calculate optimal card height
      const totalGaps = Math.max(0, rows - 1);
      const totalGapHeight = totalGaps * gap;
      const contentPadding = padding * 2; // top and bottom padding

      const optimalCardHeight = Math.max(
        isExpanded ? 80 : 48, // Minimum height (expanded: 60px, collapsed: 48px)
        Math.min(
          isExpanded ? 120 : 80, // Maximum height (expanded: 120px, collapsed: 80px)
          (contentAvailableHeight - totalGapHeight - contentPadding) / rows
        )
      );

      setCardHeight(optimalCardHeight);
    };

    calculateHeight();

    // Recalculate on window resize with debounce
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(calculateHeight, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [isExpanded, itemCount]);

  return { cardHeight, contentRef, headerRef };
};

// Section component
const CollapsibleSection = ({
  title,
  children,
  isExpanded,
  isCollapsed,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}) => {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200 ${
          isExpanded ? 'px-3' : 'px-2'
        }`}
      >
        {isExpanded ? (
          <span className="truncate">{title}</span>
        ) : (
          <span className="truncate font-bold text-gray-800">{title.charAt(0)}</span>
        )}
        {isExpanded &&
          (isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ))}
      </button>
      {!isCollapsed && <div className={`${isExpanded ? 'p-3' : 'p-1'}`}>{children}</div>}
    </div>
  );
};

export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const { state } = useSidebar();
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [isDrawingReferenceLine, setIsDrawingReferenceLine] = useState(false);
  const [isDrawingGlowingLine, setIsDrawingGlowingLine] = useState(false);
  const isExpanded = state === 'expanded';
  const [lineLengthDialogOpen, setLineLengthDialogOpen] = useState(false);
  const [currentLineLength, setCurrentLineLength] = useState(0);
  const [currentReferenceLine, setCurrentReferenceLine] = useState<fabric.Line | null>(null);

  // Section collapse states
  const [collapsedSections, setCollapsedSections] = useState<{
    spatial: boolean;
    lighting: boolean;
    controls: boolean;
  }>({
    spatial: false,
    lighting: false,
    controls: false,
  });

  // Ref to track if auto reference line has been triggered
  const hasTriggeredAutoReference = useRef(false);

  const { useProject, updateProject } = useProjects();
  const params = useParams();
  const projectId = params.projectId as string;
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { canvas, setShouldRecordHistory } = useCanvas();
  const { setOrigin } = useRuler();

  // Redux hooks
  const dispatch = useDispatch();
  const { shapeSizes, pixelToFeetRatio: runtimePixelToFeetRatio } = useSelector(
    (state: RootState) => state.canvasReducer
  );

  const pixelToFeetRatio =
    (runtimePixelToFeetRatio ?? null) !== null
      ? (runtimePixelToFeetRatio as number)
      : project?.pixelToFeetRatio || null;

  const hasPixelToFeetRatio = pixelToFeetRatio !== null;

  // Calculate optimal card height
  const { cardHeight, contentRef, headerRef } = useOptimalCardHeight(isExpanded, sidebar.length);

  const {
    addGlowingCircle,
    addCircleWithArrowOut,
    presenceSensor,
    addArrowShape,
    addParallelLines,
    addGlowingRectangle,
    // addRectangle,
    addCircleX,
    addLetterDShape,
    addPolygon,
    addGlowingLine,
    drawReferenceLine,
    addLetterSShape,
    addSconceVertica,
    addSconceDirectional,
    addSconceWash,
    addChandelier,
  } = useFabricShapes();

  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [isSettingOrigin, setIsSettingOrigin] = useState(false);

  // Function to calculate default size based on pixel-to-feet ratio
  const getDefaultSize = (shapeId: number): number => {
    // Check if we have a saved size for this shape
    if (shapeSizes[shapeId]) {
      return shapeSizes[shapeId];
    }

    if (!pixelToFeetRatio) {
      // Default sizes when no ratio is set
      switch (shapeId) {
        case 1: // Recessed
        case 2: // Step
        case 3: // Presence sensor
        case 15: // Sconce Vertical
        case 16: // Sconce Directional
        case 17: // Sconce Wash
        case 18: // Chandelier
          return 12; // Default radius
        case 4: // Spot - increased default size
          return 50; // Increased default size
        case 5: // Pendant (Linear)
        case 6: // Tape
          return 200; // Default length
        case 7: // Light - smaller default
          return 40; // Smaller default size
        default:
          return 50;
      }
    }

    // Calculate size based on pixel-to-feet ratio
    // 12 inches = 1 foot
    const defaultSizeInFeet = 1; // 1 foot default
    const defaultSizeInPixels = defaultSizeInFeet * pixelToFeetRatio;

    switch (shapeId) {
      case 1:
        return (4 / 12) * pixelToFeetRatio;
      case 2:
        return (4 / 12) * pixelToFeetRatio;
      case 3:
        return (6 / 12) * pixelToFeetRatio;
      case 4:
        return (4 / 12) * pixelToFeetRatio;
      case 5:
        return (24 / 12) * pixelToFeetRatio;
      case 6:
        return (12 / 12) * pixelToFeetRatio;
      case 7:
        return (24 / 12) * pixelToFeetRatio;
      case 8:
        return (4 / 12) * pixelToFeetRatio;
      case 15:
        return (4 / 12) * pixelToFeetRatio;
      case 16:
        return (4 / 12) * pixelToFeetRatio;
      case 17:
        return (4 / 12) * pixelToFeetRatio;
      case 18:
        return (4 / 12) * pixelToFeetRatio;
      default:
        return defaultSizeInPixels;
    }
  };

  const getShapeFunction = (id: number, name: string) => {
    const defaultSize = getDefaultSize(id);

    switch (id) {
      case 1:
        return () => addGlowingCircle(name, id, { radius: defaultSize / 2 });
      case 2:
        return () => addCircleWithArrowOut(name, id, { radius: defaultSize / 2 });
      case 3:
        return () => presenceSensor(name, id, { radius: defaultSize / 2 });
      case 4:
        return () => addArrowShape(name, id, { radius: defaultSize / 2 });
      case 5:
        return () => addGlowingRectangle(name, id, { width: defaultSize });
      case 6:
        return () => addParallelLines(name, id, { width: defaultSize });
      case 7:
        return () => addLetterDShape(name, id, { width: defaultSize });
      case 8:
        return () => addCircleX(name, id, { radius: defaultSize / 2 });
      case 15:
        return () => addSconceVertica(name, id, { radius: defaultSize / 2 });
      case 16:
        return () => addSconceDirectional(name, id, { radius: defaultSize / 2 });
      case 17:
        return () => addSconceWash(name, id, { radius: defaultSize / 2 });
      case 18:
        return () => addChandelier(name, id, { radius: defaultSize / 2 });
      // case 9:
      //    return () => addRectangle('Zone', id);
      case 10:
        return () => {
          // Determine next zone index based on current number of polygons on canvas
          const polygonCount = canvas
            ? canvas.getObjects().filter(o => o.type === 'polygon').length
            : 0;
          const nextZoneIndex = polygonCount + 1;
          const zoneName = `Zone ${nextZoneIndex}`;
          addPolygon(zoneName, id, setIsDrawingPolygon);
        };
      case 11:
        return () => addGlowingLine(name, id, setIsDrawingGlowingLine);
      case 12:
        return () => {
          setShouldRecordHistory(false);
          drawReferenceLine(
            name,
            id,
            setIsDrawingReferenceLine,
            (length: number, line: fabric.Line) => {
              setCurrentLineLength(length);
              setCurrentReferenceLine(line);
              setLineLengthDialogOpen(true);
            }
          );
        };
      case 14:
        return () => {
          setShouldRecordHistory(false);
          setIsSettingOrigin(true);
          toast.message('Click anywhere on the canvas to set the ruler origin');
        };
      case 13:
        return () => addLetterSShape(name, id, { width: 5 });
      default:
        return () => {};
    }
  };

  useEffect(() => {
    if (
      project &&
      !hasPixelToFeetRatio &&
      !isDrawingReferenceLine &&
      canvas &&
      !hasTriggeredAutoReference.current
    ) {
      hasTriggeredAutoReference.current = true;

      const timer = setTimeout(() => {
        // Only auto-trigger if still no ratio and not manually drawing
        if (!hasPixelToFeetRatio && !isDrawingReferenceLine) {
          const shapeFunction = getShapeFunction(12, 'Reference Line');
          shapeFunction();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [project, hasPixelToFeetRatio, isDrawingReferenceLine, canvas]);

  // Function to check if a shape button should be disabled
  const isShapeDisabled = (itemId: number): boolean => {
    // Reference line is never disabled - it can be used to update the ratio
    if (itemId === 12) return false;
    if (itemId === 14) return false;

    // Other drawing tools are disabled if no pixel-to-feet ratio is set
    if (!hasPixelToFeetRatio) return true;
    if (isDrawingGlowingLine) return true;
    return false;
  };

  const handleShapeClick = (id: number, name: string) => {
    // Check if the shape is disabled
    if (isShapeDisabled(id)) {
      return toast.warning('Please draw a reference line first to set the scale');
    }
    if (isDrawingPolygon) {
      return toast.warning('Please finish the polygon to add another shape');
    }

    if (isDrawingReferenceLine) {
      return toast.warning('Please finish the reference line to add another shape');
    }

    const shapeFunction = getShapeFunction(id, name);
    shapeFunction();
  };

  // Handle origin placement when in suspended state
  useEffect(() => {
    if (!canvas) return;

    const handleMouseDown = (e: fabric.TEvent) => {
      if (!isSettingOrigin) return;
      const pointer = canvas.getPointer(e.e);
      setOrigin(pointer.x, pointer.y);
      setIsSettingOrigin(false);
      setShouldRecordHistory(true);
      toast.success('Origin set');
      canvas.requestRenderAll();
    };

    canvas.on('mouse:down', handleMouseDown);
    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [canvas, isSettingOrigin, setOrigin, setShouldRecordHistory]);

  // Updated handleLineLengthSave function with proper history management
  const handleLineLengthSave = async (length: number) => {
    // Calculate pixel to feet ratio
    // length is in feet, currentLineLength is in pixels
    const ratio = currentLineLength / length;

    try {
      if (!canvas) return;

      // 1) Adjust existing element sizes to maintain real-world dimensions
      const previousRatio: number | null =
        (runtimePixelToFeetRatio ?? null) !== null
          ? (runtimePixelToFeetRatio as number)
          : (project?.pixelToFeetRatio ?? null);

      // Remove the reference line from canvas
      if (currentReferenceLine && canvas) {
        canvas.remove(currentReferenceLine);
        canvas.renderAll();
      }

      if (previousRatio && previousRatio > 0) {
        const scaleFactor = ratio / previousRatio;
        canvas.getObjects().forEach(obj => {
          if (obj.type !== 'group') return;
          const group = obj as fabric.Group;
          const shapeId = group.get('shapeId');
          if (!shapeId) return;

          const currentScaleX = group.scaleX || 1;
          const currentScaleY = group.scaleY || 1;

          if ([1, 2, 3, 4, 8, 7, 13, 15, 16, 17, 18].includes(shapeId)) {
            // Circle-based shapes (including pendant id 8, sconces, and chandelier): scale uniformly
            group.set({
              scaleX: currentScaleX * scaleFactor,
              scaleY: currentScaleY * scaleFactor,
            });
            group.setCoords();
            return;
          }

          if ([5, 6].includes(shapeId)) {
            // Linear fixtures: if the group actually contains a line, scale X only
            const hasLineChild = !!group.getObjects().find(child => child.type === 'line');
            const newScaleX = currentScaleX * scaleFactor;
            const newScaleY = hasLineChild ? currentScaleY : currentScaleY * scaleFactor;
            group.set({ scaleX: newScaleX, scaleY: newScaleY });
            group.setCoords();
            return;
          }
        });
        canvas.requestRenderAll();
      }

      // 2) Save JSON snapshot and thumbnail with updated sizes and ratio
      const canvasData = canvas.toJSON();
      const dataURL = canvas.toDataURL({ format: 'png', quality: 1.0, multiplier: 1 });

      await updateProject({
        id: projectId,
        data: {
          pixelToFeetRatio: ratio,
          thumbnail: dataURL,
          data: JSON.stringify(canvasData),
          canvasWidth: canvas.getWidth(),
          canvasHeight: canvas.getHeight(),
        },
      });

      // 3) Update runtime ratio in Redux store

      setLineLengthDialogOpen(false);
      setCurrentReferenceLine(null);

      // Reset the drawing state
      setIsDrawingReferenceLine(false);

      // Reset history recording to true after reference line is handled
      setShouldRecordHistory(true);

      // Reset the auto-trigger flag so it doesn't interfere with manual actions
      hasTriggeredAutoReference.current = false;

      dispatch(clearShapeSizes());
      dispatch(setPixelToFeetRatio(ratio));
      // Show success message
      toast.success('Reference line saved successfully!');
    } catch (error) {
      console.error('Error saving pixel to feet ratio:', error);
      toast.error('Failed to save reference line. Please try again.');

      // Reset drawing state even on error
      setIsDrawingReferenceLine(false);
      // Reset history recording to true even on error
      setShouldRecordHistory(true);
    }
  };

  const handleLineLengthCancel = () => {
    // Remove the reference line from canvas
    if (currentReferenceLine && canvas) {
      canvas.remove(currentReferenceLine);
      canvas.renderAll();
    }

    setLineLengthDialogOpen(false);
    setCurrentReferenceLine(null);

    // Reset the drawing state
    setIsDrawingReferenceLine(false);

    // Reset history recording to true when cancelled
    setShouldRecordHistory(true);

    // FIXED: Don't reset hasTriggeredAutoReference to prevent auto-trigger from running again
    // Instead, set it to true to indicate that the auto-trigger has been handled
    hasTriggeredAutoReference.current = true;
  };

  // Toggle section collapse
  const toggleSection = (section: 'spatial' | 'lighting' | 'controls') => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Render shape item
  const renderShapeItem = (item: SidebarElements) => {
    const isHovered = hoveredId === item.id;
    const isDisabled = isShapeDisabled(item.id);
    const isClickable =
      !isDisabled &&
      (!isDrawingPolygon || item.id === 10) &&
      (!isDrawingReferenceLine || item.id === 12) &&
      (!isSettingOrigin || item.id === 14);

    return (
      <div
        key={item.id}
        className={`
          relative flex flex-col items-center justify-center rounded-lg border w-full group
          ${isHovered && !isDisabled ? 'border-blue-300 shadow-md shadow-blue-300/40 scale-[1.03] bg-gradient-to-br from-blue-50 to-indigo-50' : 'border-gray-200'}
          ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}
          ${isDrawingPolygon && item.id !== 10 && !isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isDrawingReferenceLine && item.id !== 12 && !isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isSettingOrigin && item.id !== 14 && !isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${!isDisabled && isClickable ? 'cursor-pointer' : ''}
          ${item.id === 10 && isDrawingPolygon ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-md shadow-blue-300/40' : ''}
          ${item.id === 12 && isDrawingReferenceLine ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-md shadow-blue-300/40' : ''}
          ${item.id === 14 && isSettingOrigin ? 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-md shadow-blue-300/40' : ''}
          ${isExpanded ? 'px-2 gap-1' : 'px-1 gap-1'}
          transition-all duration-300 
        `}
        style={{ height: `${cardHeight}px` }}
        onClick={() => (isClickable ? handleShapeClick(item.id, item.title) : null)}
        onMouseEnter={() => !isDisabled && setHoveredId(item.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        {isHovered && !isDisabled && (
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 p-[1px]">
            <div className="w-full h-full bg-white rounded-lg"></div>
          </div>
        )}

        <div
          className={`relative ${isExpanded ? 'h-10 w-10 px-2' : 'h-6 w-6 px-1'} z-10 flex items-center justify-center`}
        >
          <Image
            src={item.image}
            alt={item.image}
            fill
            priority
            className={`select-none pointer-events-none object-contain ${isDisabled ? 'grayscale' : ''}`}
          />
        </div>

        {isExpanded && (
          <p
            className={`text-xs font-medium text-center select-none pointer-events-none z-10 leading-tight ${isDisabled ? 'text-gray-400' : 'text-gray-700'}`}
          >
            {item.title}
          </p>
        )}

        {item.id === 10 && isDrawingPolygon && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse border-2 border-white shadow"></div>
        )}

        {item.id === 12 && isDrawingReferenceLine && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse border-2 border-white shadow"></div>
        )}

        {/* Highlight reference line when no ratio is set */}
        {item.id === 12 && !hasPixelToFeetRatio && !isDrawingReferenceLine && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse border-2 border-white shadow"></div>
        )}
        {item.id === 14 && isSettingOrigin && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse border-2 border-white shadow"></div>
        )}
      </div>
    );
  };

  if (isProjectLoading) {
    return <AppSidebarSkeleton />;
  }

  return (
    <>
      <Sidebar
        collapsible="icon"
        {...props}
        className="bg-white overflow-hidden ml-4 rounded-[16px] border border-gray-200 shadow-lg shadow-gray-200/50 backdrop-blur-sm"
      >
        <SidebarHeader
          ref={headerRef}
          className={`flex flex-col items-center border-b border-gray-100 ${isExpanded ? 'p-4' : 'p-2'}`}
        >
          {isExpanded && (
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-lg font-semibold text-gray-800">Design Elements</p>
              </div>
              <SidebarTrigger className="border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded-lg p-1" />
            </div>
          )}
          {!isExpanded && (
            <div className="flex w-full justify-end mb-1">
              <SidebarTrigger className="border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded-lg p-1" />
            </div>
          )}
        </SidebarHeader>
        <SidebarContent
          ref={contentRef}
          className={`overflow-y-auto max-w-full ${isExpanded ? 'p-0' : 'p-1'}`}
        >
          {/* Spatial Section - First 2 elements */}
          <CollapsibleSection
            title="Spatial"
            isExpanded={isExpanded}
            isCollapsed={collapsedSections.spatial}
            onToggle={() => toggleSection('spatial')}
          >
            <div
              className={`grid ${isExpanded ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-1'}`}
              style={{
                gridTemplateRows: `repeat(${isExpanded ? Math.ceil(Math.min(2, sidebar.length) / 2) : Math.min(2, sidebar.length)}, ${cardHeight}px)`,
              }}
            >
              {sidebar.slice(0, 2).map(renderShapeItem)}
            </div>
          </CollapsibleSection>

          {/* Lighting Section - Next 10 elements */}
          <CollapsibleSection
            title="Lighting"
            isExpanded={isExpanded}
            isCollapsed={collapsedSections.lighting}
            onToggle={() => toggleSection('lighting')}
          >
            <div
              className={`grid ${isExpanded ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-1'}`}
              style={{
                gridTemplateRows: `repeat(${isExpanded ? Math.ceil(Math.min(10, sidebar.length - 2) / 2) : Math.min(10, sidebar.length - 2)}, ${cardHeight}px)`,
              }}
            >
              {sidebar.slice(2, 12).map(renderShapeItem)}
            </div>
          </CollapsibleSection>

          {/* Controls Section - Remaining elements */}
          <CollapsibleSection
            title="Controls"
            isExpanded={isExpanded}
            isCollapsed={collapsedSections.controls}
            onToggle={() => toggleSection('controls')}
          >
            <div
              className={`grid ${isExpanded ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-1'}`}
              style={{
                gridTemplateRows: `repeat(${isExpanded ? Math.ceil((sidebar.length - 12) / 2) : sidebar.length - 12}, ${cardHeight}px)`,
              }}
            >
              {sidebar.slice(12).map(renderShapeItem)}
            </div>
          </CollapsibleSection>
        </SidebarContent>
      </Sidebar>

      <LineLengthDialog
        open={lineLengthDialogOpen}
        lineLength={currentLineLength}
        onSave={handleLineLengthSave}
        onCancel={handleLineLengthCancel}
      />
    </>
  );
};
