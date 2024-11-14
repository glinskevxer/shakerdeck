# shakerdeck

Mud check, hydraulics and material balance for a drilling fluids service.

This is the desk a mud engineer works from between the rig floor and the
morning report. It reads the sheets that already get filled in by hand, works
out the things that are otherwise done on the back of a tour sheet, and prints
them in a shape that goes straight onto a daily report.

It is a command line tool and a library. Nothing in it talks to a network,
nothing writes unless it is told to, and every input is a json file, so it runs
on a rig laptop with no connection.

## What it does

- reads a mud check and works the rheology, solids and chemistry out of it
- fits all three rheology models and scores them against the readings taken
- works the whole circulating system: velocities, pressure losses, bit
  hydraulics, circulating density and whether the hole is cleaning
- balances weight ups, cut backs, blends and dilutions
- runs the solids control spread as a train and puts a value on it against
  dilution alone
- judges a run of checks against the mud programme and finds the window nobody
  is meeting
- runs product stock, values what was used and says what needs ordering
- builds the daily mud report and the end of well recap

## Getting started

```
npm install
npm test
node bin/shakerdeck.js commands
```

## The commands

Every command reads json, prints a page by default, and takes `--format json`
if the output is going somewhere else.

### check

Reads one mud check sheet.

```
node bin/shakerdeck.js check -c examples/check-brazos.json
```

Everything past the well, the date, the depth and the weight is optional,
because a check run at four in the morning while tripping has a weight and a
funnel and nothing else. What is missing is left out of the page rather than
printed as a zero.

### hydraulics

Works the circulating system out for a well at a rate.

```
node bin/shakerdeck.js hydraulics -w examples/well-brazos.json -c examples/check-brazos.json
```

The annulus is split at every point where either the hole or the string
changes, so the velocity that gets reported as the worst is the one in the
casing rather than the one past the collars that everybody quotes.

Pass `--rate` to try a different pump rate without editing the well file.

### daily

Builds the daily mud report.

```
node bin/shakerdeck.js daily -d examples/day-brazos.json -c examples/check-brazos.json -p examples/programme-brazos.json -P examples/products.json
```

Add `--summary` for the one line version that goes in an email.

### mix

Works out a mixing order.

```
node bin/shakerdeck.js mix -j "weight up" --from 12.4 --to 13.5 -v 800
node bin/shakerdeck.js mix -j "cut back" --from 12.4 --to 11.5 -v 800
node bin/shakerdeck.js mix -j blend --from 9.2 --to 12.4 --heavy 16 -v 400
node bin/shakerdeck.js mix -j dilute --from-solids 0.06 --to-solids 0.05 -v 800
```

Add `--hold-volume` to dump mud first so the system ends the size it started.

### programme

Prints the mud programme, plans a section off it, or judges a run of checks
against it.

```
node bin/shakerdeck.js programme -p examples/programme-brazos.json
node bin/shakerdeck.js programme -p examples/programme-brazos.json -c examples/checks-brazos.json
node bin/shakerdeck.js programme -p examples/programme-brazos.json -s intermediate -t examples/treatments.json -P examples/products.json
```

### solids

Runs the solids control spread over a day of cuttings.

```
node bin/shakerdeck.js solids -s examples/solids-control.json
```

### stock

Runs the product movements and reports what needs ordering.

```
node bin/shakerdeck.js stock -P examples/products.json -m examples/movements.json -b examples/opening-stock.json
```

### recap

Writes the end of well recap off every check and every day.

```
node bin/shakerdeck.js recap -c examples/checks-brazos.json -p examples/programme-brazos.json -d examples/days-brazos.json -P examples/products.json
```

### commands

```
node bin/shakerdeck.js commands
node bin/shakerdeck.js commands -v
```

## Using it as a library

```js
import { bingham, powerlaw, ecd } from 'shakerdeck';

const dials = { 600: 64, 300: 42, 200: 33, 100: 23, 6: 6, 3: 5 };
bingham.binghamSummary(dials);
powerlaw.powerLawSummary(dials);
ecd.equivalentCirculatingDensity({ weightPpg: 12.4, annularLossPsi: 336, tvdFeet: 10000 });
```

## Units

Field units throughout: pounds a gallon, barrels, feet, inches, gallons a
minute, pounds force per hundred square feet, degrees fahrenheit. Conversions
live in `src/units/` and are applied at the edges rather than inline.

Two unit traps are handled in one place each rather than at every call, because
both have bitten this codebase and both are silent:

- the consistency index comes out of the rheology in pounds force per hundred
  square feet times seconds to the n, and the API Reynolds forms want
  equivalent centipoise. They are a factor of 478.8 apart.
- Moore's laminar slip velocity constant is published with the viscosity in
  poise. Everything else on the desk is in centipoise.

## Running the checks

```
npm run lint
npm run format:check
npm test
npm run coverage
npm run smoke
```

`npm run check` runs all of them.

## Layout

| where                | what                                                |
| -------------------- | --------------------------------------------------- |
| `src/units/`         | density, volume, length and temperature conversions |
| `src/util/`          | number parsing, tables, text, csv                   |
| `src/valid/`         | the shape checker every input file goes through     |
| `src/rheology/`      | the viscometer and the three models                 |
| `src/mudcheck/`      | the check sheet and its chemistry                   |
| `src/solids/`        | retort solids analysis                              |
| `src/material/`      | weight up, dilution, pills                          |
| `src/well/`          | capacities, pump output, geometry, slugs            |
| `src/hydraulics/`    | velocity, pressure loss, bit, ecd, swab and surge   |
| `src/solidscontrol/` | screens, cones and the centrifuge                   |
| `src/pits/`          | tank volumes and the totalizer                      |
| `src/waste/`         | cuttings, retention and haulage                     |
| `src/inventory/`     | stock and reordering                                |
| `src/cost/`          | daily cost and cost per foot                        |
| `src/program/`       | the mud programme and section planning              |
| `src/quality/`       | control charts, trends and exceptions               |
| `src/wellcontrol/`   | the mud side of the kill sheet                      |
| `src/report/`        | the daily report page                               |
| `src/cli/`           | the command line                                    |

## Licence

MIT.
