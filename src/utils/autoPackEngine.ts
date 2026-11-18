import type {
  AutoPackArrangement,
  BelongingItem,
  PackedUnitPlacement,
  PackingGuideStep,
  SuitcaseConfig,
  UnfittedItemInfo,
} from "../types";
import {
  calculateLuggageMath,
  getEffectiveItemDimensions,
  round1,
} from "./mathEngine";

const EPS = 0.05;

export interface BoxBounds {
  x: number;
  y: number;
  z: number;
  dimX: number;
  dimY: number;
  dimZ: number;
}

export function boxesOverlap(a: BoxBounds, b: BoxBounds): boolean {
  const overlapX = a.x < b.x + b.dimX - EPS && a.x + a.dimX > b.x + EPS;
  const overlapY = a.y < b.y + b.dimY - EPS && a.y + a.dimY > b.y + EPS;
  const overlapZ = a.z < b.z + b.dimZ - EPS && a.z + a.dimZ > b.z + EPS;
  return overlapX && overlapY && overlapZ;
}

export function isWithinSuitcaseBounds(
  box: BoxBounds,
  internalL: number,
  internalH: number,
  internalW: number
): boolean {
  return (
    box.x >= -EPS &&
    box.y >= -EPS &&
    box.z >= -EPS &&
    box.x + box.dimX <= internalL + EPS &&
    box.y + box.dimY <= internalH + EPS &&
    box.z + box.dimZ <= internalW + EPS
  );
}

export function canPlaceBox(
  candidate: BoxBounds,
  placed: BoxBounds[],
  internalL: number,
  internalH: number,
  internalW: number,
  ignoreIndex = -1
): boolean {
  if (!isWithinSuitcaseBounds(candidate, internalL, internalH, internalW)) {
    return false;
  }
  for (let i = 0; i < placed.length; i++) {
    if (i === ignoreIndex) continue;
    if (boxesOverlap(candidate, placed[i])) {
      return false;
    }
  }
  return true;
}

export function verifyLayoutNoOverlap(
  placements: PackedUnitPlacement[],
  suitcase: SuitcaseConfig
): boolean {
  const { internalL, internalH, internalW } = calculateLuggageMath(suitcase);
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    if (!isWithinSuitcaseBounds(a, internalL, internalH, internalW)) {
      return false;
    }
    for (let j = i + 1; j < placements.length; j++) {
      if (boxesOverlap(a, placements[j])) {
        return false;
      }
    }
  }
  return true;
}

interface OrientationOption {
  dimX: number;
  dimY: number;
  dimZ: number;
  label: string;
}

function getUniqueOrientations(l: number, w: number, h: number): OrientationOption[] {
  const raw: OrientationOption[] = [
    { dimX: l, dimY: h, dimZ: w, label: "Flat (L×W)" },
    { dimX: w, dimY: h, dimZ: l, label: "Flat Rotated 90°" },
    { dimX: l, dimY: w, dimZ: h, label: "On Edge (L×H)" },
    { dimX: h, dimY: w, dimZ: l, label: "On Edge Rotated" },
    { dimX: w, dimY: l, dimZ: h, label: "Upright (W×H)" },
    { dimX: h, dimY: l, dimZ: w, label: "Upright Rotated" },
  ];
  const seen = new Set<string>();
  const unique: OrientationOption[] = [];
  for (const opt of raw) {
    const key = `${opt.dimX.toFixed(1)}-${opt.dimY.toFixed(1)}-${opt.dimZ.toFixed(1)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(opt);
    }
  }
  return unique;
}

interface ExpandedUnit {
  unitKey: string;
  item: BelongingItem;
  unitIndex: number;
  dims: [number, number, number];
  compressed: boolean;
}

function expandItems(items: BelongingItem[], forceCompress: boolean): ExpandedUnit[] {
  const units: ExpandedUnit[] = [];
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity));
    const useCompressed = item.compressed || (forceCompress && item.compressibility > 0);
    const dims = getEffectiveItemDimensions(item, forceCompress);
    for (let i = 0; i < qty; i++) {
      units.push({
        unitKey: `${item.id}#${i}`,
        item,
        unitIndex: i,
        dims,
        compressed: useCompressed && item.compressibility > 0,
      });
    }
  }
  return units;
}

function buildGuideSteps(
  placements: PackedUnitPlacement[],
  unfitted: UnfittedItemInfo[],
  internalH: number
): PackingGuideStep[] {
  const bottomItems = new Set<string>();
  const foldedClothes = new Set<string>();
  const shoesAndToiletries = new Set<string>();
  const topAccessories = new Set<string>();

  for (const p of placements) {
    const isBottom = p.y <= Math.max(2, internalH * 0.25);
    if (p.category === "Electronic Devices" || (isBottom && p.weightKg >= 0.45)) {
      bottomItems.add(p.name);
    } else if (
      p.category === "T-shirts & Shirts" ||
      p.category === "Trousers & Jeans" ||
      p.category === "Dresses" ||
      p.category === "Jackets" ||
      p.category === "Towels"
    ) {
      foldedClothes.add(p.name);
    } else if (p.category === "Shoes" || p.category === "Toiletries") {
      shoesAndToiletries.add(p.name);
    } else {
      topAccessories.add(p.name);
    }
  }

  const formatList = (set: Set<string>, fallback: string) =>
    set.size > 0 ? Array.from(set) : [fallback];

  return [
    {
      stepNumber: 1,
      title: "Place larger and heavier items at the bottom",
      description:
        "Anchor the base layer near the suitcase wheels and back spine to keep the center of gravity low and protect rigid items.",
      itemsIncluded: formatList(bottomItems, "No heavy base items in this layout"),
    },
    {
      stepNumber: 2,
      title: "Arrange folded clothes in flat, tight blocks",
      description:
        "Pack folded shirts, trousers, and jackets side-by-side to form a level middle layer with minimal air pockets.",
      itemsIncluded: formatList(foldedClothes, "No folded garments selected"),
    },
    {
      stepNumber: 3,
      title: "Position shoes and toiletries in side cavities",
      description:
        "Tuck shoes heel-to-toe and nest toiletry kits along the perimeter edges where rigid shapes lock together.",
      itemsIncluded: formatList(shoesAndToiletries, "No shoes or toiletries in this layout"),
    },
    {
      stepNumber: 4,
      title: "Fill top gaps with smaller accessories",
      description:
        "Use remaining upper corner cavities for adapters, sunglasses, and compact personal belongings.",
      itemsIncluded: formatList(topAccessories, "No small top-layer accessories"),
    },
    {
      stepNumber: 5,
      title: "Review fit, compression, and final weight",
      description:
        unfitted.length > 0
          ? `${unfitted.length} unit(s) exceeded rigid cavity bounds. Enable fabric compression or remove non-essential items before zipping.`
          : "All selected items fit cleanly within internal shell boundaries with zero overlap. Ready to zip and weigh.",
      itemsIncluded:
        unfitted.length > 0
          ? unfitted.map((u) => `${u.name} (unfitted)`)
          : ["All items verified inside bounds"],
    },
  ];
}

function runExtremePointPack(
  units: ExpandedUnit[],
  suitcase: SuitcaseConfig,
  strategyId: string,
  strategyName: string,
  strategySummary: string,
  recommended: boolean,
  mode: "weight-balanced" | "max-space" | "compressed"
): AutoPackArrangement {
  const luggageMath = calculateLuggageMath(suitcase);
  const { internalL, internalH, internalW, usableVolumeCm3 } = luggageMath;

  const sorted = [...units].sort((a, b) => {
    const volA = a.dims[0] * a.dims[1] * a.dims[2];
    const volB = b.dims[0] * b.dims[1] * b.dims[2];
    if (mode === "weight-balanced") {
      // Heavy & rigid items first so they land at y = 0
      const rigidScoreA = a.item.shape === "box" ? 1 : 0;
      const rigidScoreB = b.item.shape === "box" ? 1 : 0;
      const scoreA = a.item.weightKg * 2.4 + rigidScoreA * 0.8 + volA / 5000;
      const scoreB = b.item.weightKg * 2.4 + rigidScoreB * 0.8 + volB / 5000;
      return scoreB - scoreA;
    }
    // Max-space / compressed: sort by volume descending, then max edge
    if (Math.abs(volB - volA) > 40) return volB - volA;
    return Math.max(...b.dims) - Math.max(...a.dims);
  });

  // Candidate anchor points in (x, y, z)
  const anchors: Array<{ x: number; y: number; z: number }> = [{ x: 0, y: 0, z: 0 }];
  const placements: PackedUnitPlacement[] = [];
  const unfitted: UnfittedItemInfo[] = [];

  for (const unit of sorted) {
    const [l, w, h] = unit.dims;
    const orientations = getUniqueOrientations(l, w, h);

    let bestPlacement: {
      x: number;
      y: number;
      z: number;
      opt: OrientationOption;
      score: number;
    } | null = null;

    // Sort anchors bottom-first (lowest Y), then lowest X, then lowest Z
    anchors.sort((a, b) => {
      if (Math.abs(a.y - b.y) > EPS) return a.y - b.y;
      if (Math.abs(a.x - b.x) > EPS) return a.x - b.x;
      return a.z - b.z;
    });

    for (const pt of anchors) {
      for (const opt of orientations) {
        const candidate: BoxBounds = {
          x: round1(pt.x),
          y: round1(pt.y),
          z: round1(pt.z),
          dimX: opt.dimX,
          dimY: opt.dimY,
          dimZ: opt.dimZ,
        };

        if (!canPlaceBox(candidate, placements, internalL, internalH, internalW)) {
          continue;
        }

        // Compute contact & compactness score (lower is better)
        const topY = candidate.y + candidate.dimY;
        const maxX = candidate.x + candidate.dimX;
        const maxZ = candidate.z + candidate.dimZ;

        // Prefer flat placement (lower dimY) for clothes & laptops
        const flatnessPenalty =
          unit.item.category === "Electronic Devices" || unit.item.compressibility > 0
            ? opt.dimY * 1.4
            : opt.dimY * 0.6;

        const score =
          candidate.y * 120 +
          topY * 25 +
          maxX * 1.4 +
          maxZ * 1.6 +
          flatnessPenalty;

        if (!bestPlacement || score < bestPlacement.score) {
          bestPlacement = {
            x: candidate.x,
            y: candidate.y,
            z: candidate.z,
            opt,
            score,
          };
        }
      }
    }

    if (bestPlacement) {
      const placed: PackedUnitPlacement = {
        unitKey: unit.unitKey,
        itemId: unit.item.id,
        unitIndex: unit.unitIndex,
        name: unit.item.name,
        category: unit.item.category,
        shape: unit.item.shape,
        colorHex: unit.item.colorHex,
        x: bestPlacement.x,
        y: bestPlacement.y,
        z: bestPlacement.z,
        dimX: bestPlacement.opt.dimX,
        dimY: bestPlacement.opt.dimY,
        dimZ: bestPlacement.opt.dimZ,
        orientationLabel: bestPlacement.opt.label,
        weightKg: unit.item.weightKg,
        compressed: unit.compressed,
      };
      placements.push(placed);

      // Generate new extreme points from placed bounding box corners
      const nextPoints = [
        { x: round1(placed.x + placed.dimX), y: placed.y, z: placed.z },
        { x: placed.x, y: round1(placed.y + placed.dimY), z: placed.z },
        { x: placed.x, y: placed.y, z: round1(placed.z + placed.dimZ) },
      ];
      for (const np of nextPoints) {
        if (
          np.x < internalL - EPS &&
          np.y < internalH - EPS &&
          np.z < internalW - EPS
        ) {
          const exists = anchors.some(
            (a) =>
              Math.abs(a.x - np.x) < EPS &&
              Math.abs(a.y - np.y) < EPS &&
              Math.abs(a.z - np.z) < EPS
          );
          if (!exists) anchors.push(np);
        }
      }
    } else {
      const maxInternal = Math.max(internalL, internalW, internalH);
      const minInternal = Math.min(internalL, internalW, internalH);
      let reason = "No contiguous 3D space left inside suitcase cavity.";
      if (Math.max(l, w, h) > maxInternal) {
        reason = `Longest edge (${Math.max(l, w, h)} cm) exceeds suitcase internal length (${internalL} cm).`;
      } else if (Math.min(l, w, h) > minInternal) {
        reason = `Minimum thickness (${Math.min(l, w, h)} cm) exceeds internal depth (${internalH} cm).`;
      }
      unfitted.push({
        unitKey: unit.unitKey,
        itemId: unit.item.id,
        name: unit.item.name,
        category: unit.item.category,
        dimensionsCm: unit.dims,
        reason,
      });
    }
  }

  let packedVolumeCm3 = 0;
  let weightedY = 0;
  let totalWeight = 0;

  for (const p of placements) {
    packedVolumeCm3 += p.dimX * p.dimY * p.dimZ;
    const centerY = p.y + p.dimY / 2;
    weightedY += centerY * p.weightKg;
    totalWeight += p.weightKg;
  }

  const utilizationPct =
    usableVolumeCm3 > 0
      ? round1(Math.min(100, (packedVolumeCm3 / usableVolumeCm3) * 100))
      : 0;

  const centerOfGravityRatioY =
    totalWeight > 0 && internalH > 0 ? round1((weightedY / totalWeight / internalH) * 100) : 0;

  return {
    id: strategyId,
    strategyName,
    strategySummary,
    recommended,
    placements,
    unfitted,
    packedVolumeCm3: round1(packedVolumeCm3),
    utilizationPct,
    totalUnitsPlaced: placements.length,
    totalUnitsRequested: sorted.length,
    centerOfGravityRatioY,
    guideSteps: buildGuideSteps(placements, unfitted, internalH),
    verifiedNoOverlap: verifyLayoutNoOverlap(placements, suitcase),
  };
}

export function generateAutoPackArrangements(
  suitcase: SuitcaseConfig,
  items: BelongingItem[]
): AutoPackArrangement[] {
  const standardUnits = expandItems(items, false);
  const compressedUnits = expandItems(items, true);

  const arr1 = runExtremePointPack(
    standardUnits,
    suitcase,
    "weight-balanced",
    "Weight-Balanced Base",
    "Places heavier & rigid gear at the bottom near the wheels, with folded clothes layered above.",
    true,
    "weight-balanced"
  );

  const arr2 = runExtremePointPack(
    standardUnits,
    suitcase,
    "max-space",
    "Volume-First Compact",
    "Prioritizes largest geometric blocks across all 6 orthogonal rotations to minimize void space.",
    false,
    "max-space"
  );

  const arr3 = runExtremePointPack(
    compressedUnits,
    suitcase,
    "compressed-fold",
    "Compressed Roll & Fold",
    "Applies realistic 20–30% fabric compression to soft garments and towels to unlock extra capacity.",
    false,
    "compressed"
  );

  return [arr1, arr2, arr3];
}

export function findFirstValidSpotForItem(
  item: BelongingItem,
  unitIndex: number,
  existing: PackedUnitPlacement[],
  suitcase: SuitcaseConfig
): PackedUnitPlacement | null {
  const { internalL, internalH, internalW } = calculateLuggageMath(suitcase);
  const [l, w, h] = getEffectiveItemDimensions(item, false);
  const orientations = getUniqueOrientations(l, w, h);

  const candidates: Array<{ x: number; y: number; z: number }> = [{ x: 0, y: 0, z: 0 }];
  for (const p of existing) {
    candidates.push({ x: round1(p.x + p.dimX), y: p.y, z: p.z });
    candidates.push({ x: p.x, y: round1(p.y + p.dimY), z: p.z });
    candidates.push({ x: p.x, y: p.y, z: round1(p.z + p.dimZ) });
  }
  candidates.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);

  for (const pt of candidates) {
    for (const opt of orientations) {
      const box: BoxBounds = {
        x: pt.x,
        y: pt.y,
        z: pt.z,
        dimX: opt.dimX,
        dimY: opt.dimY,
        dimZ: opt.dimZ,
      };
      if (canPlaceBox(box, existing, internalL, internalH, internalW)) {
        return {
          unitKey: `${item.id}#${unitIndex}`,
          itemId: item.id,
          unitIndex,
          name: item.name,
          category: item.category,
          shape: item.shape,
          colorHex: item.colorHex,
          x: box.x,
          y: box.y,
          z: box.z,
          dimX: box.dimX,
          dimY: box.dimY,
          dimZ: box.dimZ,
          orientationLabel: opt.label,
          weightKg: item.weightKg,
          compressed: item.compressed,
        };
      }
    }
  }
  return null;
}

export function rotatePlacement90(
  placement: PackedUnitPlacement,
  axis: "y" | "x" | "z",
  allPlacements: PackedUnitPlacement[],
  suitcase: SuitcaseConfig
): PackedUnitPlacement | null {
  const { internalL, internalH, internalW } = calculateLuggageMath(suitcase);
  const idx = allPlacements.findIndex((p) => p.unitKey === placement.unitKey);

  let nextDimX = placement.dimX;
  let nextDimY = placement.dimY;
  let nextDimZ = placement.dimZ;

  if (axis === "y") {
    nextDimX = placement.dimZ;
    nextDimZ = placement.dimX;
  } else if (axis === "x") {
    nextDimY = placement.dimZ;
    nextDimZ = placement.dimY;
  } else {
    nextDimX = placement.dimY;
    nextDimY = placement.dimX;
  }

  // Try current origin, or shift inward if near edge
  const tryX = Math.min(placement.x, Math.max(0, round1(internalL - nextDimX)));
  const tryY = Math.min(placement.y, Math.max(0, round1(internalH - nextDimY)));
  const tryZ = Math.min(placement.z, Math.max(0, round1(internalW - nextDimZ)));

  const candidate: BoxBounds = {
    x: tryX,
    y: tryY,
    z: tryZ,
    dimX: nextDimX,
    dimY: nextDimY,
    dimZ: nextDimZ,
  };

  if (canPlaceBox(candidate, allPlacements, internalL, internalH, internalW, idx)) {
    return {
      ...placement,
      x: candidate.x,
      y: candidate.y,
      z: candidate.z,
      dimX: nextDimX,
      dimY: nextDimY,
      dimZ: nextDimZ,
      orientationLabel: `Rotated (${nextDimX}×${nextDimZ}×${nextDimY})`,
    };
  }
  return null;
}
