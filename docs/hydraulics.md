# Hydraulics

The circulating system is worked one length of constant geometry at a time.
Nothing is averaged, because the averages are what hide the problem.

## The order it is worked in

1. The hole and the string are read into sections and matched against each
   other, so the annulus is split at every point where either of them changes.
   `src/well/geometry.js`
2. Each length gets its own velocity, Reynolds number, friction factor and
   pressure loss. `src/hydraulics/velocity.js`, `src/hydraulics/reynolds.js`,
   `src/hydraulics/pressure-loss.js`
3. Surface equipment goes in as an equivalent length of drill pipe, so there is
   one pressure loss routine rather than two that behave differently at low
   rates. `src/hydraulics/system.js`
4. The bit takes whatever is left of the pump pressure.
   `src/hydraulics/bit.js`
5. The annular loss goes on top of the hydrostatic as circulating density, with
   the cuttings the mud is carrying. `src/hydraulics/ecd.js`

## The slowest length is the one that matters

Every rig quotes the annular velocity past the collars, because it is the
biggest number on the sheet. It is also the length where the hole is cleanest.
The length that decides whether cuttings leave the hole is the slowest one,
which on most wells is the casing, and `slowestAnnulus` is what the report
prints.

## Which rheology model feeds which calculation

- inside the pipe: the power law fitted through the six hundred and three
  hundred readings
- in the annulus: the power law fitted through the one hundred and three
  readings
- hole cleaning: the annular fit again, at the shear rate the flow is actually
  at

They are different fits of the same mud and they give different answers on
purpose. A mud that looks the same at six hundred can behave very differently
at the shear rates in a wide annulus.

## Where the correlations stop meaning much

The annular apparent viscosity runs away at very low shear rates, so a very
wide hole at a slow pump rate produces a transport ratio that looks fine and is
not. `tests/edges/extremes.test.js` holds that case on purpose. Read the
velocity itself there: a twenty six inch hole at twenty feet a minute does not
clean, whatever the ratio says.

## Optimising the nozzles

Two criteria that do not agree. Maximum hydraulic horsepower wants about two
thirds of the pump pressure spent across the bit; maximum jet impact force
wants about half. `src/hydraulics/optimise.js` works both and prints both,
because which one is right depends on the formation rather than on the
arithmetic.
