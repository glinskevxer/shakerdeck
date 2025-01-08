# Reading the viscometer

The instrument is a Fann 35 with the standard R1 rotor, B1 bob and F1 spring.
Anything else needs its readings scaled before they reach `src/rheology/`.

## Three models, and why all three are carried

Each model is exact at the pair of speeds it was fitted through and none of
them is right everywhere.

- **Bingham plastic** is two numbers off the six hundred and three hundred
  readings. It is what every hand on the rig reads and it is what the daily
  report leads with. It is also a straight line, so it overstates the stress
  badly at the low shear rates that matter in a wide annulus. On a working mud
  it is out by fifteen dial degrees at three rpm.
- **Power law** follows the curve far better. It is fitted through a _pair_,
  and which pair matters: six hundred and three hundred describe the mud inside
  the pipe, one hundred and three describe it out in the annulus.
- **Herschel Bulkley** puts a yield stress under the power law. It is the one
  the hydraulics use when the low speed readings are there.

`src/rheology/compare.js` scores all three over every reading that was taken
and prints the spread, which is how the choice gets made rather than argued.

## The yield point is quoted in dial degrees

A dial degree on the F1 spring is 1.0678 pounds force per hundred square feet,
and the yield point on every daily report is quoted straight off the dial as
though the factor were one.

`src/rheology/bingham.js` keeps that convention, because the number on the
report has to match the number the company man works out on the back of the
tour sheet. `src/rheology/herschel.js` applies the factor, because its output
feeds the hydraulics.

Both are documented at the top of their own file. Do not quietly make them
agree.

## Low shear yield point

Twice the three rpm reading less the six. It is the number that predicts
whether cuttings stay up in a wide annulus, and it is the one that moves when
the mud is treated for hole cleaning. It is not the yield point and it is not
interchangeable with it.
