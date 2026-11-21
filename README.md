# Read Broken CSV Files Faster

[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/RizkyRizk/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/RizkyRizk/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, make.fun's own CSV reader. `run(input)` returns,
for every case's input `{text, header}`, exactly the answer csv-reader 1.0.0 returns:
`{columns, rows, errors}` — the same broken-row policy (BOM dropped, stray CRs, unterminated
quotes, quote junk, short and long rows), byte for byte.

## How it is faster

The reference reads one character at a time and builds every field a character at a time.
This reader scans with `indexOf` instead:

- an ordinary unquoted field is a single slice, found by the next comma or line break
  (a CR is only looked for inside that short segment, never further ahead);
- a quoted field is one slice per doubled quote; only a quoted field that actually holds
  a line break pays for counting and normalising it.

On the kit's practice set it runs about 4–6x faster than the house baseline
(csv-reader 1.0.0 itself), with identical output on every case.

## Layout

- `solve.js` — dependency-free ES module exporting `run(input)`.
- `main.ts` — the driver the harness runs: reads every case from `/input/cases.json`,
  answers each with `run`, writes `/output/answers.json`.

## Bounty

[Read broken CSV files faster, 21 November 2026](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
on [make.fun](https://make.fun).
