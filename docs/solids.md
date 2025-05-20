# Solids

## What the retort gives and what it does not

The retort gives the volume the solids take up. It says nothing about what they
are, and the difference between a barrel of barite and a barrel of drilled
shale is the whole of the job.

The split comes out of a weight balance. The mud weighs what it weighs, the
liquids are known, so whatever is left has an average gravity, and that gravity
places the solids between barite at 4.2 and drilled solids at 2.6.

An average gravity outside about 2.4 to 4.3 means the retort, the balance or
the salinity correction is wrong. `doctor` checks for exactly that, and it does
not compare the weight back against the gravity, because the gravity was worked
out from the weight and would agree by construction.

## The spread is a train, not a list

Each piece of equipment only ever sees what the one before it left. Running
each stage against the original size distribution counts the same coarse solids
again at every stage, and reports a spread removing ninety nine percent of what
a rig actually removes half of.

`passedDistribution` in `src/solidscontrol/screens.js` is what carries the sizes
forward. It was added after the solids command reported a removal efficiency of
99.8 percent, which is not a number any rig has ever seen.

## The equipment that is not running removes nothing

A centrifuge on the rental sheet for thirty days that ran for nine removed
three tenths of what its rating says.
`src/solidscontrol/utilisation.js` carries the hours, and
`effectiveRemoval` puts the rating and the hours together into the number the
mud actually saw.

## Dilution against removal

Drilled solids leave the system two ways: through the equipment, or out with
mud that is thrown away. The second is always the expensive one, because every
barrel of water added to a weighted mud has to be weighted back up and treated
again.

`dilutionAgainstRemoval` in `src/material/dilution.js` puts a number on the
difference over a hole section. It is worth printing on the daily report where
the drilling superintendent can see it.
