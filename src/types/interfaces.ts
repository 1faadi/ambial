import { EditProjectFormData } from '@/utils/validations';

export interface HeaderProps {
  breadcrumbs: string[];
}

export interface SidebarElements {
  id: number;
  image: string;
  title: string;
  type: string;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  profileImage?: string;
}

export interface Project {
  id: string;
  name: string;
  pixelToFeetRatio: number | null;
  thumbnail: string | null;
  data: string | null;
  canvasWidth: number;
  canvasHeight: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface LineLengthDialogProps {
  open: boolean;
  lineLength: number;
  onSave: (length: number) => void;
  onCancel: () => void;
}

export interface Point {
  x: number;
  y: number;
}

export interface Prediction {
  class: string;
  class_id: number;
  confidence: number;
  detection_id: string;
  height: number;
  points: Point[];
  width: number;
  x: number;
  y: number;
  roomType?: string;
  features?: string;
}

export interface FloorPlanSegmentationResponse {
  image: {
    width: number;
    height: number;
  };
  inference_id: string;
  predictions: Prediction[];
}

export interface AiAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ReferenceLineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  setShouldRecordHistory: (value: boolean) => void;
}

export interface CreateProjectData {
  name: string;
  pixelToFeetRatio?: number | null;
  thumbnail?: string;
  data?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface UpdateProjectData {
  name?: string;
  pixelToFeetRatio?: number | null;
  thumbnail?: string;
  data?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ProjectCardProps {
  project: Project;
}

export interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: EditProjectFormData) => Promise<void>;
  initialName: string;
  isLoading?: boolean;
}

export interface OriginalProperties {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  fontSize: number;
}

export interface ColorPickerProps {
  initialColor?: string;
  onColorChange?: (color: string) => void;
  onClose?: () => void;
  isOverlay?: boolean;
}

export interface CanvasObject {
  id: string;
  type: string;
  name: string;
  roomName?: string;
  features?: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  fontSize?: number;
  text?: string;
  visible?: boolean;
  opacity?: number;
  shapeId?: number;
}

export interface ProgressLossDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface Manufacturer {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Fixture {
  id: string;
  sequentialId: number;
  fixtureType: string;
  modelName: string;
  sizeIn?: number | null;
  manufacturer?: string | null;
  price?: number | null;
  lumens?: number | null;
  peakPowerW?: number | null;
  maxVoltageV?: number | null;
  maxCurrentA?: number | null;
  minPWM?: number | null;
  maxPWM?: number | null;
  dimmingMode?: string | null;
  dimmingCurve?: string | null;
  minCCT?: number | null;
  midCCT?: number | null;
  maxCCT?: number | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  sidebarId?: number | null;
  channelCount?: number | null;
  dimmingGamma?: number | null;
}

export interface LightingData {
  light_id: string;
  reason: string;
  name: string;
  x: number;
  y: number;
}

export interface CreateFixtureData {
  fixtureType: string;
  modelName: string;
  sizeIn?: number | null;
  manufacturer: string;
  price?: number | null;
  lumens?: number | null;
  peakPowerW?: number | null;
  maxVoltageV?: number | null;
  maxCurrentA?: number | null;
  minPWM?: number | null;
  maxPWM?: number | null;
  dimmingMode?: string | null;
  dimmingCurve?: string | null;
  minCCT?: number | null;
  midCCT?: number | null;
  maxCCT?: number | null;
  sidebarId?: number | null;
  channelCount?: number | null;
  dimmingGamma?: number | null;
}

export interface RoomAnalysis {
  roomType: string;
  features: string;
}
