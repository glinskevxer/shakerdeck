# Units, and the two that bite

Everything on this desk is in field units. Density in pounds a gallon, volume
in barrels, depth in feet, diameters in inches, rate in gallons a minute, shear
stress in pounds force per hundred square feet, temperature in fahrenheit.

Conversions live in `src/units/` and are applied at the edges. Nothing in the
middle of a calculation converts anything, because a conversion buried three
calls down is a conversion nobody finds.

## The consistency index

The rheology fits produce `K` in pounds force per hundred square feet times
seconds to the n, because that follows from the shear stress the viscometer
actually measures.

The API 13D Reynolds and pressure loss forms want `K` in equivalent
centipoise. The two are a factor of **478.8** apart, which is 4.788 dyne per
square centimetre times a hundred.

Feeding the rheology figure straight into the API forms reads every Reynolds
number about five hundred times high. A laminar annulus comes back turbulent,
the friction factor comes off the wrong correlation and the annular pressure
loss roughly doubles. Nothing throws, and the answer looks like an answer.

The conversion is applied once, inside `src/hydraulics/reynolds.js`, and the
constant is exported so a test can assert it.

## Moore's laminar constant

The slip velocity correlation is published as

    Vs = 82.87 dp^2 (rho_s - rho_f) / mu

with the viscosity in **poise**. Everything else on the desk is in centipoise.

Using the published constant with centipoise puts the slip velocity a hundred
times low, which makes a hole that is packing off look like it is cleaning
perfectly. The constant in `src/hydraulics/cuttings.js` is 8287, with the
hundred already in it, and the argument stays in centipoise like every other
viscosity in the codebase.

## The gradient constant

`0.052` is what the desk prints, because it is what the driller works with on
the tour sheet and a report that disagrees with him by a tenth of a psi per
hundred feet gets argued about. `0.0519481` is available as `exact` for
anything that is being compared against a gauge.

## Where the constants live

| constant               | value            | where                        |
| ---------------------- | ---------------- | ---------------------------- |
| fresh water            | 8.3454 ppg       | `src/units/density.js`       |
| gradient               | 0.052 psi/ft/ppg | `src/units/density.js`       |
| capacity               | 1029.4           | `src/well/capacity.js`       |
| velocity               | 24.5             | `src/hydraulics/velocity.js` |
| barrel of water        | 350 lb           | `src/solids/analysis.js`     |
| lab barrel             | 350 ml           | `src/mudcheck/pilot.js`      |
| shear rate per rpm     | 1.7023           | `src/rheology/dial.js`       |
| stress per dial degree | 1.0678           | `src/rheology/dial.js`       |
