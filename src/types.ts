export type AppTab = "home" | "scanner" | "items" | "virtual" | "profile";

export type LuggageType = "carry-on" | "checked";

export type ItemCategory =
  | "T-shirts & Shirts"
  | "Trousers & Jeans"
  | "Dresses"
  | "Jackets"
  | "Shoes"
  | "Toiletries"
  | "Towels"
  | "Accessories"
  | "Electronic Devices"
  | "Other Personal Belongings";

export type GeometricShape = "box" | "cylinder" | "compressible_prism";

export interface SuitcaseConfig {
  id: string;
  name: string;
  type: LuggageType;
  lengthCm: number; // External longest dimension (height when standing, X in open flat 3D view)
  widthCm: number; // External width (Z in open flat 3D view)
  heightCm: number; // External depth/thickness (Y in open flat 3D view)
  emptyWeightKg: number;
  wallThicknessCm: number; // Shell & lining thickness per side
  usableEfficiency: number; // 0.80 - 0.92 account for wheel wells & handle rails
  measurementSource: "manual" | "camera-ar" | "preset";
  confidencePct: number;
}

export interface BelongingItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number; // Weight per single unit
  shape: GeometricShape;
  compressibility: number; // 0 (rigid) to 0.35 (compressible fabric)
  compressed: boolean; // Whether user applies folded compression
  colorHex: string;
  essential: boolean;
  liquidMl: number; // 0 if solid, >0 for liquid toiletries
  source: "manual" | "camera" | "preset";
  confidencePct?: number;
}

export interface PackedUnitPlacement {
  unitKey: string; // `${itemId}#${unitIndex}`
  itemId: string;
  unitIndex: number;
  name: string;
  category: ItemCategory;
  shape: GeometricShape;
  colorHex: string;
  // Coordinates in suitcase internal space (cm), origin at bottom-left-back corner (0,0,0)
  // X = [0, internalLengthCm], Y = [0, internalHeightCm] (vertical depth), Z = [0, internalWidthCm]
  x: number;
  y: number;
  z: number;
  dimX: number;
  dimY: number;
  dimZ: number;
  orientationLabel: string;
  weightKg: number;
  compressed: boolean;
}

export interface UnfittedItemInfo {
  unitKey: string;
  itemId: string;
  name: string;
  category: ItemCategory;
  dimensionsCm: [number, number, number];
  reason: string;
}

export interface PackingGuideStep {
  stepNumber: number;
  title: string;
  description: string;
  itemsIncluded: string[];
}

export interface AutoPackArrangement {
  id: string;
  strategyName: string;
  strategySummary: string;
  recommended: boolean;
  placements: PackedUnitPlacement[];
  unfitted: UnfittedItemInfo[];
  packedVolumeCm3: number;
  utilizationPct: number;
  totalUnitsPlaced: number;
  totalUnitsRequested: number;
  centerOfGravityRatioY: number; // Lower = better bottom-heavy stability
  guideSteps: PackingGuideStep[];
  verifiedNoOverlap: boolean;
}

export interface AirlinePolicy {
  id: string;
  airlineName: string;
  category: LuggageType;
  maxLengthCm: number;
  maxWidthCm: number;
  maxHeightCm: number;
  maxLinearSumCm: number;
  maxWeightKg: number;
  maxSingleLiquidMl: number;
  maxTotalCabinLiquidMl: number;
  liquidPolicyNote: string;
}

export type ComplianceStatus = "COMPLIANT" | "WARNING" | "EXCEEDED";

export interface ComplianceCheckRow {
  metric: string;
  actualLabel: string;
  limitLabel: string;
  ratio: number;
  status: ComplianceStatus;
}

export interface ComplianceReport {
  overallStatus: ComplianceStatus;
  rows: ComplianceCheckRow[];
  summaryText: string;
}

export interface PackingRecommendation {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  actionTab?: AppTab;
  actionLabel?: string;
}

export interface TripInfo {
  tripName: string;
  destination: string;
  departureDate: string;
  durationDays: number;
}

export interface SavedPackingSession {
  id: string;
  savedAt: string;
  trip: TripInfo;
  suitcase: SuitcaseConfig;
  items: BelongingItem[];
  placements: PackedUnitPlacement[];
  airlinePolicy: AirlinePolicy;
}
