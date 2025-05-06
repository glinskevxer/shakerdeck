/**
 * The section command: what one hole section actually took.
 */
import { buildSectionReport, renderSectionReport } from '../../report/section.js';
import { readProgramme } from '../../program/window.js';
import { readChecks } from '../../mudcheck/record.js';
import { readProduct } from '../../inventory/stock.js';
import { dayCost } from '../../cost/daily.js';
import { sectionPlan } from '../../program/section.js';

/**
 * Value the days that fall inside the section.
 */
export function daysInSection({ days, products, from, to }) {
  if (!products) {
    return [];
  }
  const priceList = products.map((row, index) => readProduct(row, `products[${index}]`));
  return days
    .filter((day) => day.date >= from && day.date <= to)
    .map((day) =>
      dayCost({
        date: day.date,
        products: priceList,
        used: day.used ?? {},
        footageFeet: day.footageFeet ?? 0,
        mudBuiltBbl: day.mudBuiltBbl ?? 0,
        serviceCharge: day.serviceCharge ?? 0,
        rentalCharge: day.rentalCharge ?? 0,
        haulageCharge: day.haulageCharge ?? 0,
      })
    );
}

export function sectionCommand({
  name,
  checks,
  programme,
  days = null,
  products = null,
  treatments = null,
  surfaceSystemBbl = 500,
}) {
  const plan = readProgramme(programme);
  const section = plan.sections.find((row) => row.name === name);
  if (!section) {
    throw new Error(`there is no section called ${name} in the programme`);
  }
  const read = readChecks(checks);
  const inSection = read.filter(
    (check) => check.depthFeet > section.fromFeet && check.depthFeet <= section.toFeet
  );
  const valued = days
    ? daysInSection({
        days,
        products,
        from: inSection[0]?.date ?? '0000-00-00',
        to: inSection.at(-1)?.date ?? '9999-99-99',
      })
    : [];
  const planned =
    treatments && products && section.holeSizeInches
      ? sectionPlan({
          section,
          treatments,
          products: products.map((row, index) => readProduct(row, `products[${index}]`)),
          surfaceSystemBbl,
        })
      : null;
  const data = buildSectionReport({
    section,
    checks: read,
    programme: plan,
    days: valued,
    planned,
  });
  return { data, lines: renderSectionReport(data) };
}
