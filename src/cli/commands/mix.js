/**
 * The mix command: what to add to move the mud where it needs to go.
 *
 * One command rather than three, because the question on the rig is always the
 * same shape. The mud is here and it needs to be there, and the answer is a
 * weight of something and a volume the system will grow by.
 */
import {
  weightUp,
  weightUpHoldingVolume,
  cutBack,
  blendToTarget,
} from '../../material/weightup.js';
import { dilutionToTarget, dilutionHoldingVolume } from '../../material/dilution.js';
import { heading, rule } from '../../util/text.js';
import { definitionList } from '../../util/table.js';

/**
 * Work out a mixing order.
 */
export function readMix({
  job,
  fromPpg,
  toPpg,
  volumeBbl,
  agent = 'barite',
  holdVolume = false,
  dilutantPpg = null,
  fromFraction = null,
  toFraction = null,
  heavyPpg = null,
}) {
  if (job === 'weight up') {
    const result = holdVolume
      ? weightUpHoldingVolume({ fromPpg, toPpg, volumeBbl, agent })
      : weightUp({ fromPpg, toPpg, volumeBbl, agent });
    return { job, ...result };
  }
  if (job === 'cut back') {
    const options = { fromPpg, toPpg, volumeBbl };
    if (dilutantPpg !== null) {
      options.dilutantPpg = dilutantPpg;
    }
    return { job, ...cutBack(options) };
  }
  if (job === 'blend') {
    if (heavyPpg === null) {
      throw new Error('a blend needs the weight of the heavy mud');
    }
    return {
      job,
      ...blendToTarget({
        lightPpg: fromPpg,
        heavyPpg,
        targetPpg: toPpg,
        lightVolumeBbl: volumeBbl,
      }),
    };
  }
  if (job === 'dilute') {
    if (fromFraction === null || toFraction === null) {
      throw new Error('a dilution needs the solids fraction it is going from and to');
    }
    const result = holdVolume
      ? dilutionHoldingVolume({ fromFraction, toFraction, volumeBbl })
      : dilutionToTarget({ fromFraction, toFraction, volumeBbl });
    return { job, ...result };
  }
  throw new Error(`there is no mixing job called ${job}`);
}

/**
 * Lay the order out.
 */
export function renderMix(data) {
  const rows = Object.entries(data)
    .filter(([key]) => key !== 'job')
    .map(([key, value]) => [key.replace(/([A-Z])/g, ' $1').toLowerCase(), value]);
  return [heading(`mixing order  ${data.job}`), rule(50), ...definitionList(rows)];
}

export function mixCommand(options) {
  const data = readMix(options);
  return { data, lines: renderMix(data) };
}
