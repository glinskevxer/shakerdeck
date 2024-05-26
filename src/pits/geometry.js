/**
 * Pit and tank volumes from a level reading.
 *
 * A rig tank is rarely a plain box. Most of the active pits have a sloped
 * bottom so they drain and so the agitators do not sit in a dead corner, and
 * the trip tank is often a horizontal cylinder. Reading either of those as a
 * box puts the volume out by enough to hide a small kick.
 */
import { toPositive, toNonNegative, round } from '../util/number.js';
import { CUBIC_FEET_PER_BARREL } from '../units/measure.js';

/**
 * A plain rectangular tank.
 */
export function rectangularVolume({ lengthFeet, widthFeet, levelFeet }) {
  const length = toPositive(lengthFeet, 'lengthFeet');
  const width = toPositive(widthFeet, 'widthFeet');
  const level = toNonNegative(levelFeet, 'levelFeet');
  return (length * width * level) / CUBIC_FEET_PER_BARREL;
}

/**
 * A tank with a sloped bottom, given as a depth the slope runs over and the
 * width the bottom narrows to.
 *
 * Below the top of the slope the cross section is a trapezium. Above it the
 * tank is a box again.
 */
export function slopedBottomVolume({
  lengthFeet,
  widthFeet,
  bottomWidthFeet,
  slopeHeightFeet,
  levelFeet,
}) {
  const length = toPositive(lengthFeet, 'lengthFeet');
  const width = toPositive(widthFeet, 'widthFeet');
  const bottom = toNonNegative(bottomWidthFeet, 'bottomWidthFeet');
  const slope = toPositive(slopeHeightFeet, 'slopeHeightFeet');
  const level = toNonNegative(levelFeet, 'levelFeet');
  if (bottom > width) {
    throw new Error(`the bottom of the tank is wider than the top`);
  }
  const inSlope = Math.min(level, slope);
  const widthAtLevel = bottom + ((width - bottom) * inSlope) / slope;
  const slopeArea = ((bottom + widthAtLevel) / 2) * inSlope;
  const aboveSlope = Math.max(0, level - slope) * width;
  return (length * (slopeArea + aboveSlope)) / CUBIC_FEET_PER_BARREL;
}

/**
 * A vertical cylinder.
 */
export function verticalCylinderVolume({ diameterFeet, levelFeet }) {
  const diameter = toPositive(diameterFeet, 'diameterFeet');
  const level = toNonNegative(levelFeet, 'levelFeet');
  return ((Math.PI / 4) * diameter * diameter * level) / CUBIC_FEET_PER_BARREL;
}

/**
 * A horizontal cylinder, part full. The wetted cross section is a circular
 * segment, which is where the trip tank on most rigs sits.
 */
export function horizontalCylinderVolume({ diameterFeet, lengthFeet, levelFeet }) {
  const diameter = toPositive(diameterFeet, 'diameterFeet');
  const length = toPositive(lengthFeet, 'lengthFeet');
  const level = toNonNegative(levelFeet, 'levelFeet');
  if (level > diameter) {
    throw new Error(`a level of ${level} feet is over the top of a ${diameter} foot tank`);
  }
  const radius = diameter / 2;
  const height = level;
  const angle = 2 * Math.acos((radius - height) / radius);
  const area = (radius * radius * (angle - Math.sin(angle))) / 2;
  return (area * length) / CUBIC_FEET_PER_BARREL;
}

/**
 * Volume for a tank described the way the rig book describes it.
 */
export function tankVolume(tank, levelFeet) {
  const shape = String(tank?.shape ?? 'rectangular').toLowerCase();
  if (shape === 'rectangular') {
    return rectangularVolume({ ...tank, levelFeet });
  }
  if (shape === 'sloped') {
    return slopedBottomVolume({ ...tank, levelFeet });
  }
  if (shape === 'vertical cylinder') {
    return verticalCylinderVolume({ ...tank, levelFeet });
  }
  if (shape === 'horizontal cylinder') {
    return horizontalCylinderVolume({ ...tank, levelFeet });
  }
  throw new Error(`unknown tank shape: ${tank.shape}`);
}

/**
 * Barrels for each foot of level at the level the tank is at now.
 *
 * On a sloped or cylindrical tank this changes with the level, which is why a
 * single figure painted on the side of the tank is misleading near the bottom.
 */
export function barrelsPerFoot(tank, levelFeet) {
  const level = toNonNegative(levelFeet, 'levelFeet');
  const step = 0.01;
  const low = Math.max(0, level - step / 2);
  const high = low + step;
  return (tankVolume(tank, high) - tankVolume(tank, low)) / step;
}

/**
 * The tank as the pit report prints it.
 */
export function describeTank(tank, levelFeet) {
  return {
    name: String(tank?.name ?? 'tank'),
    shape: String(tank?.shape ?? 'rectangular'),
    levelFeet: toNonNegative(levelFeet, 'levelFeet'),
    volumeBbl: round(tankVolume(tank, levelFeet), 1),
    barrelsPerFoot: round(barrelsPerFoot(tank, levelFeet), 2),
  };
}
