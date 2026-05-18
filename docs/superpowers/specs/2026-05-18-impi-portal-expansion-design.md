# IMPI Portal Expansion — Design Spec
Date: 2026-05-18
Status: Approved

## Overview

Four changes to the IMPI Induction Portal, implemented and tested locally before deploying to impi-inductions.netlify.app.

---

## Change 1: Group Induction — 35 Members + Inductor Certificate

### Scope
- `public/induction.html`
- `netlify/functions/complete.js`

### Group size dropdown
Replace hardcoded `<option>` tags (currently 2–10) with a JS-generated loop for n in 2–35. Label changes to: "Number of additional team members (excluding yourself — the inductor)".

### Member row layout
5-column CSS grid per row: First Name | Surname | ID Type (dropdown) | ID Number | Trade.
- Grid: `grid-template-columns: 1fr 1fr 140px 1fr 1fr`
- Mobile (<700px): collapses to 2-column
- Rows numbered "Team Member 1", "Team Member 2", etc.
- ID Type options: SA ID / Passport / NIN / National ID / Employee No / Other (same as Step 1 form)
- All 5 fields required

### Certificate generation flow
1. Validate all member fields — show per-member error messages (e.g. "Team Member 3 needs a Trade") before making any API calls
2. Run duplicate check for inductor (Step 1 data) against completions table
3. Run duplicate check for each team member in sequence
4. For each person (inductor first, then members), generate cert code and POST to `/complete` with retry logic
5. Show progress: "Generating certificate 3 of 36..."
6. Build results array with outcome per person (success / already-completed / fraud-blocked)

### Save strategy
Individual POSTs per cert (1 inductor + N members), max 3 retry attempts each.
- **Inductor POST**: includes `is_group: true`, `group_count: N`, full Step 1 fields including `email` — triggers summary email
- **Member POSTs**: omit `email` field — backend sends no email for them (existing behavior: email only sent when `email` is present)

### Email (complete.js)
Add `group_count` field support. When `group_count > 0`:
- Subject: `"Your IMPI Safety Induction Certificate (+{N} team certificates)"`
- Body: adds line "You and {N} team members have completed the induction."
- All other email content unchanged

### Certificate display
- Inductor cert rendered first with "👑 Team Leader" badge in stripe area
- Team member certs follow in order
- Each cert shows: name, ID type + number, role, company, trade, date, unique code, QR code, IMPI logo, event logo, organiser logo (from `currentEvent`)
- Skipped certs (duplicate same-ID): shown with existing cert code + "Already completed" badge
- Blocked certs (duplicate different-ID): shown as error row with "Duplicate — different ID" note
- Print view: `page-break-after: always` on each cert → one cert per printed page

### Duplicate handling in group (Option A)
- **Same-ID match**: skip POST, add to results with existing code + "Already completed" badge. Rest of group unaffected.
- **Different-ID fraud**: skip POST, show error row at bottom. Rest of group proceeds.
- No modal blocking — errors shown inline in results list

---

## Change 2: Duplicate Registration Prevention

### New file
`netlify/functions/check-duplicate.js`

### Request
```
POST /.netlify/functions/check-duplicate
Body: { fullName, surname, eventId, idNumber }
```

### Logic
```
SELECT cert_code, id_number FROM completions
WHERE ILIKE(full_name, fullName)
  AND ILIKE(surname, surname)
  AND event_id = eventId
```

Uses Supabase `.ilike()` — ILIKE without wildcards = case-insensitive exact match.
No auth required (called from public induction page).

### Response
```json
{ "isDuplicate": bool, "hasSameId": bool, "existingCode": string|null }
```

### Frontend behaviour — single induction
- Check runs before generating cert
- `hasSameId: true` → show info modal: "You have already completed this induction. Your certificate code is: {code}"
- `isDuplicate: true, hasSameId: false` → show error modal: "A person with the name '{Name Surname}' has already completed this induction with a different ID number. Please verify your identity or contact the safety manager."

### Frontend behaviour — group induction
- Check runs inline per person during generation loop
- Results handled as described in Change 1 (inline, non-blocking)

---

## Change 3: Enhanced Admin Completions Search

### Scope
`public/admin.html`

### Layout
Completions tab header becomes a single flex row:
```
[Event Filter Dropdown]  [🔍 Search Input]  [Export CSV button]
```

### Data model
- `allCompletions` — full API result for selected event (unchanged)
- `filteredCompletions` — client-side search-filtered subset (new variable)
- `renderCompletions()` and `exportCSV()` both use `filteredCompletions`

### Search input
- `id="compSearch"`, placeholder: `🔍 Search company, name, email, ID, role...`
- `oninput="filterCompletions()"` — real-time, no API calls
- Case-insensitive partial match against: `full_name, surname, company, email, id_number, role, trade, cert_code, phone`

### `filterCompletions()` function
```javascript
function filterCompletions() {
  const q = document.getElementById('compSearch').value.trim().toLowerCase();
  filteredCompletions = q
    ? allCompletions.filter(c =>
        [c.full_name, c.surname, c.company, c.email, c.id_number,
         c.role, c.trade, c.cert_code, c.phone]
        .some(v => (v||'').toLowerCase().includes(q)))
    : [...allCompletions];
  renderCompletions();
}
```

### Count display
- Line above table
- Unfiltered: "45 completions"
- Filtered: "Showing 12 of 45 completions"
- Empty filtered: "No completions match '{query}' for {eventName}"

### loadCompletions()
After populating `allCompletions`, calls `filterCompletions()` instead of `renderCompletions()` directly (so active search is reapplied after event filter change).

### Export CSV
Exports `filteredCompletions` — whatever is currently visible.

---

## Change 4: Database Migration

Run once in Supabase SQL editor (not part of the code deployment):

```sql
CREATE INDEX IF NOT EXISTS idx_completions_dup_check
  ON completions (LOWER(full_name), LOWER(surname), event_id);
```

---

## Files Modified

| File | Change |
|------|--------|
| `public/induction.html` | Dropdown 2–35, 5-field member rows, inductor cert, progress, retry, duplicate checks, group cert display |
| `public/admin.html` | Search input, filteredCompletions, count display, CSV uses filtered data |
| `netlify/functions/complete.js` | group_count email subject/body |
| `netlify/functions/check-duplicate.js` | New file |

## Files NOT Modified
- `netlify/functions/completions.js`
- `netlify/functions/events.js`
- `netlify/functions/_shared.js`
- All other netlify functions

---

## Testing Checklist
- [ ] Single induction still works end-to-end
- [ ] Group of 5 generates 6 certs (1 inductor + 5 members)
- [ ] Group of 35 generates 36 certs without breaking
- [ ] Same name + same ID → shows existing cert code (no new cert)
- [ ] Same name + different ID → shows fraud error
- [ ] Admin event filter shows only that event's completions
- [ ] Admin search filters within selected event in real-time
- [ ] CSV export gives only filtered results
- [ ] Print view: one cert per page
