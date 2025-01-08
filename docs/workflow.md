# A tour on the desk

The order the commands get used in, on a normal day.

1. **The check.** The sheet is filled in at the shakers and read back.

   ```
   node bin/shakerdeck.js check -c examples/check-brazos.json
   ```

2. **The hydraulics.** Once the string is what it is and the rate is settled.

   ```
   node bin/shakerdeck.js hydraulics -w examples/well-brazos.json -c examples/check-brazos.json
   ```

   The slowest length of annulus is the one to look at, and it is almost never
   the one anybody quotes.

3. **The treatment.** Pilot it before it goes in the pits.

4. **The mixing order.**

   ```
   node bin/shakerdeck.js mix -j "weight up" --from 12.4 --to 13.5 -v 800
   ```

   The volume it adds is the part that gets forgotten. Weighting a full system
   up two pounds puts several hundred barrels on the ground.

5. **The pits.**

   ```
   node bin/shakerdeck.js pits -p examples/pits-brazos.json
   ```

6. **The report.**

   ```
   node bin/shakerdeck.js daily -d examples/day-brazos.json -c examples/check-brazos.json -p examples/programme-brazos.json -P examples/products.json
   ```

At the end of the section, the recap and the stock. At the end of the well,
the recap again with every day on it.

## What the desk will not do

It will not decide anything. Every command reports and none of them recommend,
except where a recommendation is a piece of arithmetic with a threshold on it,
and in those cases the threshold is a named constant in the module rather than
a number buried in a comparison.
