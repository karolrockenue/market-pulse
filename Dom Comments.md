# Dom Comments — running list for Mason & Fifth

> **For the AI reading this:** This file is a running list of things Karol needs to
> raise or discuss with Dom (Mason & Fifth) at a later stage — questions, decisions
> waiting on Dom, things we've changed that he should know about, and trade-offs he
> may want to weigh in on. Whenever something comes up during M&F / Sales Flash work
> that Dom should see or decide, add it here. **Always write entries in plain, human
> language — no code, no jargon, no table/column/endpoint names.** Assume Dom is
> smart but non-technical. Newest items go at the top. Keep each entry short: what it
> is, why it matters, what (if anything) we need from him.

---

## Belsize launch month (May) now measured from the 18th, not the 1st

**What you asked:** Belsize opened on 18 May, so could its Occupancy / ADR / RevPAR
be measured from the 18th rather than across the whole month (the empty pre-opening
days were dragging the numbers down).

**What we did:** for Belsize's opening month only, the three performance figures —
Occupancy, ADR and RevPAR — are now calculated over the trading period (18–31 May).
Occupancy jumps from ~57% to ~89%, RevPAR from ~£30 to ~£61, and ADR rises a touch
(to ~£113) because the handful of pre-opening comp nights no longer count.

**Revenue is left exactly as before** — full month for April, May and every month —
so it still ties to your Mews reports and nothing disappears. Only the three ratios
above use the 18th start. Every other property is unaffected; this only ever touches
a property's opening month.

---

## "Best In House" (and other studio types) missing from June charts — fixed

**What you'd see:** the Rate-by-Studio-Category charts dropped a studio type (e.g.
Best In House) for recent months, even though there were clearly bookings in those
rooms. Older months looked fine.

**Why:** every booking records its studio type, but our live booking feed wasn't
saving that detail — it relied on a periodic catch-up that had last run on 20 May.
So any booking made after that had no studio type, and fell out of the per-studio
charts (it still counted in the totals).

**Fixed:** the live feed now saves the studio type on every booking automatically, so
it can't go stale again, and we've filled in all the bookings that were missing it.
June's Best In House (and the rest) are back.

---

## Amenity upload wouldn't accept an Excel file — fixed

**What you hit:** on the Amenity & Building Revenue upload, the file picker wouldn't let
you select an Excel file.

**Why:** the uploader was built to accept CSV only, so the picker greyed out Excel files
(and even if selected, it could only read CSV text).

**Fixed:** the uploader now accepts **CSV or Excel** (.xlsx/.xls). Excel files are read
directly — no need to convert to CSV first. The button now says "Upload Ancillary file".

**Note for whoever's testing:** this fix isn't live on the site yet — it's waiting on the
next deploy. In the meantime the CSV version of the sheet still uploads fine on the
current site.

---

## Prior-Year columns now come from your hardcoded file (done — KPIs + Direct/Indirect)

**What you asked:** the "Prior Year" figures on the Sales Flash should come from your own
analyst file (Monthly Summary Hardcode), not be recalculated from Mews — so they match
the benchmarks investors have already seen.

**What we did:** the Prior-Year column on the KPI table is now filled straight from your
file — Occupancy, ADR, RevPAR, Short-Stay ADR, Mid-Stay ADR, Long-Stay ADR — plus the
Direct vs Indirect split (your Short-Stay Direct/Indirect booking %). All net of VAT, all
realised actuals for the prior-year month. Belsize stays blank (it's a new property with
no prior year).

**Worth knowing:**
- These are your analyst figures, so they won't perfectly tie to the current-year Mews
  numbers next to them — that's expected and intended (same as the prior-year revenue row
  already behaves).
- If you re-send an updated Monthly Summary file, we just re-import it and the Prior-Year
  columns refresh.

**Still outstanding from the "hardcode from your file" set:** the ancillary/amenity
history — we only have this financial year's ancillary figures, so we need you to confirm
whether "history" means just carrying forward the weekly uploads, or whether you have
prior-year ancillary actuals to send.

---

## Accommodation Bookings — split per segment, table + chart side by side (done)

**What Dom asked:** split the Accommodation Bookings section so Short, Mid and Long each
get their own table, with the graph to the right of its table on the same row.

**What we built:** three rows — Short Stay, Mid Stay, Long Stay — each with its weekly
table on the left (Bookings / Room nights / Revenue / Avg ADR by booking-created week)
and its own chart on the right (booking + room-night bars with a revenue line). On a
narrow screen the chart drops below its table so nothing gets squashed. The all-segment
"Reservations Created" table stays underneath as before.

**Note on the charts:** each segment's chart uses the same style (bookings + nights bars
+ revenue line). Dom's older manual file drew Mid/Long as lead-time-tier stacked bars —
if he wants that style kept specifically for Mid/Long, it's a quick switch. Flag if so.

---

## Weekly Unit Pacing — added a full-month summary column (done)

**What Dom asked:** add a full-month summary to Weekly Unit Pacing for the selected
month, so you can see the period at a glance alongside the weekly columns.

**What we built:** a new first column showing the average rooms occupied per day across
the *whole selected month*, split the same way as the weekly columns (Short / Mid / Long
/ Offline / Vacant, each as rooms and % of capacity). It's tinted and divided off so it
reads as the month total, ahead of the weekly columns.

**Worth knowing:** the month column follows the month you pick at the top of the report.
The 5 weekly columns still always show the *next 5 weeks from today* — they don't move
with the month picker. So if you select a past month, the month column reflects that
month while the weekly columns stay forward-looking. They answer two different questions
on purpose.

---

## 120-Day Occupancy chart showed full at month-start when there were vacancies — now fixed

**What Dom spotted:** The 120-Day Occupancy by Service chart showed ~100% occupancy at
the start of the month (with a big "Other" band), even though there were real vacancies.

**Why it happened:** It wasn't a chart problem — the underlying stored occupancy numbers
for a handful of early-May days were wrong. During the Long Stay service switchover, a
mid-May data refresh briefly recorded *more* rooms occupied than the building physically
has (e.g. 2 May showed 409 rooms in a 331-room property). Because we only re-check
future dates automatically, those bad past days never got corrected, so the chart kept
showing a full house. The "Other" band was just the chart trying to reconcile to the
impossible number.

**What we did:** Re-pulled the real occupancy straight from Mews for 1 April–31 May
(Westbourne + Primrose) and overwrote the stored figures so they now match Mews exactly.
2 May, for example, is now 300/331 — showing the genuine vacancies Dom saw. We only
touched occupancy; revenue was not changed.

**Note:** This also slightly nudged a lot of other days by ~1 room (live Mews is a touch
lower than the older frozen snapshots, because of late cancellations). Immaterial, but it
means the whole chart now matches Mews to the room.

---

## Headline "AVG ADR" was being dragged down by comp/management rooms — now fixed

**What Dom spotted:** On Belsize, the headline AVG ADR (£54) didn't match the Short
Stay rate (~£98), even though Belsize only has Short Stay. He suspected comp /
management bookings. He was right.

**Why it happened:** The headline rate was dividing total revenue by *every occupied
room*, including comp/management/freebie rooms that bring in little or no money. Those
freebie rooms added to the bottom of the sum but nothing to the top, so the headline
rate sank below the real selling rate. On Belsize: ~639 paying nights earning £53k =
£98/night, but ~344 extra freebie nights dragged the headline down to £54.

**What we changed:** The headline average rate now only counts paying rooms (Short +
Mid + Long), so comp/management no longer dilutes it. This matches the rule we agreed
(comp/management excluded from rate and revenue everywhere except Weekly Unit Pacing)
and the standard hotel definition of ADR. Belsize's headline now reads ~£98 and ties to
the Short row.

**Unchanged:** Occupancy still counts everyone actually in-house (including comp), as it
should — that's a true occupancy figure. RevPAR is also untouched.

**Same small trade-off as the Mid fix:** the headline rate is now a true *paying* rate,
so multiplying it by *all* occupied nights won't tie back to total revenue. That's
expected and correct.

---

## Mid Stay average rate was reading far too high (~£1,077) — now fixed

**What was wrong:** On the Sales Flash, the Mid Stay average nightly rate was showing
around £1,077 — obviously wrong. The real rate is about £120–£150.

**Why it happened:** Mid stays now bill nightly (they sit inside the Short Stay
service), which is correct. But the report was working out the rate by taking *all the
money posted to the Mid line in the month* and dividing it by *only the nights people
actually stayed that month*. The problem: when a guest's stay runs across several
months, a big lump of their charge can post up front in one month. So in April, about
£35,500 was posted to the Mid line, but only ~£5,000 of that was for nights actually
slept in April — the rest was prepaid May–August. Dividing the full lump by the few
April nights made the rate balloon.

**What we changed:** We now work out the Mid rate the honest way — each booking's own
revenue for the nights it actually stayed that month, divided by those nights. The rate
now reads ~£120–£150, matching what Dom sees when he pulls his own Mews reservation
report.

**Important — what we did NOT touch:** The headline revenue figures are untouched and
still match the official Mews finance report to the penny. We only corrected the rate
calculation.

**One thing for Dom to be aware of:** Because of the above, if you multiply the average
rate by the number of nights, it won't exactly equal the revenue line. That's expected
and correct — the revenue line legitimately includes money prepaid for future months,
whereas the rate only reflects the nights actually stayed in the month.

**Possible future discussion:** The Mid (and Long) *revenue line* for a single month is
itself slightly inflated by these prepaid lumps. We've deliberately left it as-is
because it's locked to the Mews finance report and Dom handles the month-end
adjustments. Worth a conversation if he ever wants the monthly revenue to reflect only
nights-consumed-in-month rather than money-posted-in-month.
