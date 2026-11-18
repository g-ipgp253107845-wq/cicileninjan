import type {
  BelongingItem,
  PackedUnitPlacement,
  SuitcaseConfig,
} from "../types";

export interface LuggageMathMetrics {
  externalL: number;
  externalW: number;
  externalH: number;
  linearSumCm: number;
  theoreticalVolumeCm3: number;
  theoreticalVolumeLitres: number;
  surfaceAreaCm2: number;
  internalL: number;
  internalW: number;
  internalH: number;
  internalBoxVolumeCm3: number;
  usableVolumeCm3: number;
  usableVolumeLitres: number;
  shellLossVolumeCm3: number;
}

export interface PackingSummaryMetrics {
  luggage: LuggageMathMetrics;
  totalItemsUnits: number;
  totalInventoryVolumeCm3: number;
  totalInventoryVolumeLitres: number;
  packedUnitsCount: number;
  packedVolumeCm3: number;
  packedVolumeLitres: number;
  remainingUsableCm3: number;
  remainingUsableLitres: number;
  utilizationPct: number;
  inventoryToUsablePct: number;
  itemsWeightKg: number;
  emptySuitcaseWeightKg: number;
  totalEstimatedWeightKg: number;
  maxSingleLiquidMl: number;
  totalLiquidMl: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function cmToM(cm: number): number {
  return cm / 100;
}

export function mToCm(m: number): number {
  return m * 100;
}

export function cm3ToLitres(cm3: number): number {
  return cm3 / 1000;
}

export function litresToCm3(litres: number): number {
  return litres * 1000;
}

export function kgToG(kg: number): number {
  return kg * 1000;
}

export function gToKg(g: number): number {
  return g / 1000;
}

export function getEffectiveItemDimensions(
  item: BelongingItem,
  forceCompressed = false
): [number, number, number] {
  const applyCompression = item.compressed || forceCompressed;
  const factor = applyCompression ? 1 - Math.min(0.4, Math.max(0, item.compressibility)) : 1;
  return [
    round1(item.lengthCm),
    round1(item.widthCm),
    round1(Math.max(1.2, item.heightCm * factor)),
  ];
}

export function calculateSingleItemVolumeCm3(
  item: BelongingItem,
  forceCompressed = false
): number {
  const [l, w, h] = getEffectiveItemDimensions(item, forceCompressed);
  if (item.shape === "cylinder") {
    // Cylinder oriented along its longest axis (l), cross-section diameter = min(w, h)
    const diameter = Math.min(w, h);
    const radius = diameter / 2;
    return round1(Math.PI * radius * radius * l);
  }
  // Box or compressible rectangular prism: V = l * w * h
  return round1(l * w * h);
}

export function calculateLuggageMath(suitcase: SuitcaseConfig): LuggageMathMetrics {
  const L = Math.max(10, suitcase.lengthCm);
  const W = Math.max(10, suitcase.widthCm);
  const H = Math.max(10, suitcase.heightCm);
  const wall = Math.max(0.5, suitcase.wallThicknessCm);

  const theoreticalVolumeCm3 = round1(L * W * H);
  const theoreticalVolumeLitres = round2(cm3ToLitres(theoreticalVolumeCm3));
  const surfaceAreaCm2 = round1(2 * (L * W + L * H + W * H));
  const linearSumCm = round1(L + W + H);

  // Internal dimensions deduct double shell walls and wheel/handle recess
  const internalL = round1(Math.max(10, L - wall * 2));
  const internalW = round1(Math.max(10, W - wall * 2));
  const internalH = round1(Math.max(8, H - wall * 2));

  const internalBoxVolumeCm3 = round1(internalL * internalW * internalH);
  const usableVolumeCm3 = round1(internalBoxVolumeCm3 * suitcase.usableEfficiency);
  const usableVolumeLitres = round2(cm3ToLitres(usableVolumeCm3));
  const shellLossVolumeCm3 = round1(theoreticalVolumeCm3 - usableVolumeCm3);

  return {
    externalL: L,
    externalW: W,
    externalH: H,
    linearSumCm,
    theoreticalVolumeCm3,
    theoreticalVolumeLitres,
    surfaceAreaCm2,
    internalL,
    internalW,
    internalH,
    internalBoxVolumeCm3,
    usableVolumeCm3,
    usableVolumeLitres,
    shellLossVolumeCm3,
  };
}

export function calculatePackingSummary(
  suitcase: SuitcaseConfig,
  items: BelongingItem[],
  placements: PackedUnitPlacement[]
): PackingSummaryMetrics {
  const luggage = calculateLuggageMath(suitcase);

  let totalItemsUnits = 0;
  let totalInventoryVolumeCm3 = 0;
  let itemsWeightKg = 0;
  let maxSingleLiquidMl = 0;
  let totalLiquidMl = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity);
    totalItemsUnits += qty;
    totalInventoryVolumeCm3 += calculateSingleItemVolumeCm3(item) * qty;
    itemsWeightKg += item.weightKg * qty;
    if (item.liquidMl > maxSingleLiquidMl && qty > 0) {
      maxSingleLiquidMl = item.liquidMl;
    }
    totalLiquidMl += item.liquidMl * qty;
  }

  // Packed volume from actual 3D placements
  let packedVolumeCm3 = 0;
  for (const p of placements) {
    if (p.shape === "cylinder") {
      const dims = [p.dimX, p.dimY, p.dimZ].sort((a, b) => a - b);
      const radius = dims[0] / 2;
      packedVolumeCm3 += Math.PI * radius * radius * dims[2];
    } else {
      packedVolumeCm3 += p.dimX * p.dimY * p.dimZ;
    }
  }

  packedVolumeCm3 = round1(packedVolumeCm3);
  totalInventoryVolumeCm3 = round1(totalInventoryVolumeCm3);

  const remainingUsableCm3 = round1(Math.max(0, luggage.usableVolumeCm3 - packedVolumeCm3));
  const utilizationPct =
    luggage.usableVolumeCm3 > 0
      ? round1(Math.min(100, (packedVolumeCm3 / luggage.usableVolumeCm3) * 100))
      : 0;

  const inventoryToUsablePct =
    luggage.usableVolumeCm3 > 0
      ? round1((totalInventoryVolumeCm3 / luggage.usableVolumeCm3) * 100)
      : 0;

  const totalEstimatedWeightKg = round2(suitcase.emptyWeightKg + itemsWeightKg);

  return {
    luggage,
    totalItemsUnits,
    totalInventoryVolumeCm3,
    totalInventoryVolumeLitres: round2(cm3ToLitres(totalInventoryVolumeCm3)),
    packedUnitsCount: placements.length,
    packedVolumeCm3,
    packedVolumeLitres: round2(cm3ToLitres(packedVolumeCm3)),
    remainingUsableCm3,
    remainingUsableLitres: round2(cm3ToLitres(remainingUsableCm3)),
    utilizationPct,
    inventoryToUsablePct,
    itemsWeightKg: round2(itemsWeightKg),
    emptySuitcaseWeightKg: round2(suitcase.emptyWeightKg),
    totalEstimatedWeightKg,
    maxSingleLiquidMl,
    totalLiquidMl,
  };
}
