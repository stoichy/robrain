# Evidence: Honcho LoCoMo table — accessed 2026-07-07 (historical snapshot)

**Superseded for blog claims as of 2026-07-08.** Mem0 now publishes 92.5
overall LoCoMo (`mem0-locomo-2026-07-08.md`). For the saturation argument,
cite Honcho's June 2026 benchmarking post instead of the bare-Haiku-vs-Mem0
comparison in this table.

Source: https://evals.honcho.dev (301 → https://honcho.dev/evals/)
The table is rendered client-side; numbers extracted from the page's JS
bundle: `/evals/assets/index-Bez1c_mg.js` (395,797 bytes, fetched 2026-07-07).

Raw data structure from the bundle (verbatim, reformatted):

```js
[
  { category: "Overall",     scores: { Mem0: 66.88, Zep: 75.14, "Haiku 4.5": 75.6, Honcho: 89.9 } },
  { category: "Single-Hop",  scores: { Mem0: 67.13, Zep: 74.11, "Haiku 4.5": 77.3, Honcho: 84   } },
  { category: "Multi-Hop",   scores: { Mem0: 51.15, Zep: 66.04, "Haiku 4.5": 74.5, Honcho: 88.2 } },
  { category: "Commonsense", scores: { Mem0: 72.93, Zep: 67.71, "Haiku 4.5": 90.1, Honcho: 93.2 } },
  { category: "Temporal",    scores: { Mem0: 55.51, Zep: 79.79, "Haiku 4.5": 75,   Honcho: 77.1 } },
]
```

Notes:

- The page's default view shows only **Haiku 4.5 vs Honcho**; Mem0 and Zep
  appear behind a toggle. Honcho publishes the bare-model baseline
  prominently — to their credit.
- Page metadata also advertises: 90.4% LongMem S, 89.9% LoCoMo, 0.630 BEAM 100K.
- The bare Haiku 4.5 baseline (75.6 Overall) beats Mem0 (66.88) and
  effectively ties Zep (75.14). It also beats both on Single-Hop and
  Multi-Hop, and beats Mem0 on every category except none.
- We make no claim that these numbers are wrong — they are cited as-is, as
  Honcho's own published data.

**Re-verified 2026-07-08:** same bundle (`index-Bez1c_mg.js`), Overall row
byte-identical: `{Mem0:66.88, Zep:75.14, "Haiku 4.5":75.6, Honcho:89.9}`.
Honcho blog checked same day — nothing newer than the three Jun 25, 2026 posts.
