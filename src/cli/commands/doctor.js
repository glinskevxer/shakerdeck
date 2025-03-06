/**
 * The doctor command: read the files together and report where they disagree.
 *
 * Every other command reads one or two files and trusts them. This one reads
 * the whole set and looks for the contradictions between them, which is the
 * class of mistake that survives every individual check: a mud check at a
 * depth the hole has not reached, a movement for a product the price list has
 * never heard of, a programme that stops above total depth.
 */
import { readChecks } from '../../mudcheck/record.js';
import { readProgramme, sectionAt } from '../../program/window.js';
import { readProduct } from '../../inventory/stock.js';
import { labReview } from '../../quality/lab.js';
import { solidsOf } from '../../mudcheck/derive.js';
import { missingDays } from '../../util/clock.js';
import { heading, rule } from '../../util/text.js';
import { definitionList } from '../../util/table.js';

function note(level, where, message) {
  return { level, where, message };
}

/**
 * Read every file that was given and cross check them.
 */
export function diagnose({
  well = null,
  checks = null,
  programme = null,
  products = null,
  movements = null,
  days = null,
}) {
  const notes = [];
  const read = checks ? readChecks(checks) : [];
  const plan = programme ? readProgramme(programme) : null;
  const priceList = products
    ? products.map((row, index) => readProduct(row, `products[${index}]`))
    : null;

  if (well && read.length > 0) {
    for (const check of read) {
      if (check.well !== well.well) {
        notes.push(
          note('error', 'checks', `a check is for ${check.well} and the well file is ${well.well}`)
        );
        break;
      }
    }
    const deepest = read.reduce((found, check) => Math.max(found, check.depthFeet), 0);
    if (deepest > well.totalDepthFeet) {
      notes.push(
        note(
          'error',
          'checks',
          `a check is at ${deepest} ft and the hole is ${well.totalDepthFeet} ft deep`
        )
      );
    }
  }

  if (plan && read.length > 0) {
    const off = read.filter((check) => sectionAt(plan, check.depthFeet) === null);
    if (off.length > 0) {
      notes.push(
        note(
          'warning',
          'programme',
          `${off.length} of ${read.length} checks are below the deepest section the programme covers`
        )
      );
    }
  }

  if (well && plan) {
    const bottom = plan.sections.at(-1).toFeet;
    if (bottom < well.totalDepthFeet) {
      notes.push(
        note(
          'warning',
          'programme',
          `the programme stops at ${bottom} ft and the hole is at ${well.totalDepthFeet} ft`
        )
      );
    }
  }

  if (priceList && movements) {
    const codes = new Set(priceList.map((product) => product.code));
    const unknown = [...new Set(movements.map((movement) => movement.code))].filter(
      (code) => !codes.has(code)
    );
    for (const code of unknown) {
      notes.push(note('error', 'movements', `${code} is moved but is not on the price list`));
    }
    const used = new Set(movements.map((movement) => movement.code));
    for (const product of priceList) {
      if (!used.has(product.code)) {
        notes.push(
          note('note', 'products', `${product.code} is on the price list and never moved`)
        );
      }
    }
  }

  if (priceList && days) {
    const codes = new Set(priceList.map((product) => product.code));
    for (const day of days) {
      for (const code of Object.keys(day.used ?? {})) {
        if (!codes.has(code)) {
          notes.push(
            note('error', 'days', `${day.date} uses ${code}, which is not on the price list`)
          );
        }
      }
    }
  }

  for (const check of read) {
    const solids = solidsOf(check);
    if (!solids) {
      continue;
    }
    // The average gravity is worked out FROM the weight and the retort, so
    // comparing the weight back against it agrees by construction. What is
    // worth checking is whether the gravity it produces is a gravity any real
    // solid has: below barite, above shale, and not far outside either.
    if (solids.averageSg < 2.4 || solids.averageSg > 4.3) {
      notes.push(
        note(
          'warning',
          'checks',
          `${check.date}: the balance and the retort imply solids at a gravity of ${solids.averageSg}, which is not a real solid`
        )
      );
    }
    if (solids.negativeLowGravity || solids.negativeHighGravity) {
      notes.push(note('error', 'checks', `${check.date}: the solids split came out impossible`));
    }
  }

  if (read.length >= 6) {
    const lab = labReview(read);
    for (const run of lab.copiedRuns) {
      notes.push(
        note(
          'warning',
          'checks',
          `${run.property} reads ${run.value} on ${run.length} checks in a row`
        )
      );
    }
    for (const gap of missingDays(read)) {
      notes.push(note('note', 'checks', `there is no check on ${gap}`));
    }
  }

  return {
    notes,
    errors: notes.filter((row) => row.level === 'error').length,
    warnings: notes.filter((row) => row.level === 'warning').length,
    clean: notes.every((row) => row.level === 'note'),
  };
}

/**
 * Lay the findings out.
 */
export function renderDoctor(result) {
  const lines = [
    heading('doctor'),
    rule(70),
    ...definitionList([
      ['errors', result.errors],
      ['warnings', result.warnings],
      ['notes', result.notes.length - result.errors - result.warnings],
    ]),
  ];
  if (result.notes.length === 0) {
    lines.push('', 'the files agree with each other');
    return lines;
  }
  for (const level of ['error', 'warning', 'note']) {
    const rows = result.notes.filter((row) => row.level === level);
    if (rows.length === 0) {
      continue;
    }
    lines.push('', heading(`${level}s`));
    for (const row of rows) {
      lines.push(`  ${row.where}: ${row.message}`);
    }
  }
  return lines;
}

export function doctorCommand(inputs) {
  const data = diagnose(inputs);
  return { data, lines: renderDoctor(data) };
}
