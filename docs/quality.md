# Checking the checks

Every number this desk prints comes off a sheet somebody filled in by hand. The
arithmetic is easy to get right and the readings are easy to get wrong, so most
of the quality machinery here is pointed at the sheet rather than at the code.

## Three different questions

They get confused with each other, and they are not the same question.

1. **Is the mud inside the programme?** `src/program/window.js` compares each
   reading against the window for the depth it was taken at, and
   `src/quality/exceptions.js` collects those over a run so the pattern shows.
   One check outside the window is a mud engineer catching up. The same
   property outside it on nine checks of twelve is a programme that does not
   match the well.
2. **Is the mud drifting?** `src/quality/control.js` charts a property as
   individuals with a moving range. The point is not to catch a reading outside
   the programme, which the first question already does. It is to catch a
   property walking steadily in one direction while every reading is still
   inside its window.
3. **Is the sheet real?** `src/quality/lab.js` looks for a property that has
   not moved over eight checks, a reading written to more decimal places than
   the test can produce, and a duplicate pair that disagrees by more than the
   test repeats to.

## Repeatability

`REPEATABILITY` in `src/mudcheck/pilot.js` is the list of how far two hands can
land apart on the same sample and still agree. It is used twice: to say whether
a pilot test actually moved the property, and to say whether a duplicate check
agrees with itself.

A funnel viscosity that moved two seconds is inside the repeatability of the
test and says nothing at all, however consistent the trend across three pilots
looks.

## What doctor does that nothing else does

Every other command reads one or two files and trusts them. `doctor` reads the
whole set and looks for the contradictions between them: a check at a depth the
hole has not reached, a movement for a product that is not on the price list, a
programme that stops above total depth, a weight and a retort that together
imply solids at a gravity no real solid has.

It deliberately does not compare the mud weight back against the average solids
gravity, because that gravity was worked out from the weight and would agree by
construction.

## The tests that walk the tree

`tests/consistency.test.js` reads the source tree rather than a list. A module
with no test file, an export nothing names, a module over four hundred lines, a
system clock read outside the one helper that takes the clock as an argument:
all of those fail on the next run rather than on the next review.

`tests/readme.test.js` runs every command line the readme prints, and
`tests/docs.test.js` does the same for the pages in this directory and checks
that every constant they quote is still the constant in the code.
