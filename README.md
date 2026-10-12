# FloorPlan Studio (cloud edition)

Event floor-plan tool with saved plans, revision history and staff logins.
Stack: static front end + three Vercel serverless functions + Neon Postgres. No other paid services.

## Set-up (about 15 minutes)

### 1. Neon (database)
1. Create a free project at neon.com (any region; Frankfurt or the nearest to South Africa).
2. Open **SQL Editor**, paste the contents of `schema.sql`, and run it.
3. Click **Connect** and copy the **pooled** connection string. This is `DATABASE_URL`.

### 2. GitHub
Create a new private repository and upload everything in this folder (keep the `api` and `public` folders as they are).

### 3. Vercel
1. Import the repository at vercel.com/new. Leave the framework as **Other** and the build settings blank.
2. Under **Environment Variables** add:
   - `DATABASE_URL`: the Neon string from step 1
   - `JWT_SECRET`: a long random string (`openssl rand -base64 48`, or any 40+ character random text)
3. Deploy. If your project root is not `public`, set **Output Directory** to `public`.

### 4. First run
Open the site. On the **Sheet** tab, under **Cloud**, click **Create admin account**. This only works once, while there are no users. Then use **Add team member** for your staff.

## How it works
- **Save to cloud** writes a new numbered revision every time. Nothing is overwritten, so earlier issues sent to EMS stay retrievable under **Revisions**.
- Aerial and client-plan images are stored as JPEGs (max about 4 MB each, resized to 3000 px) in the database. The free plan gives 0.5 GB per project, which is roughly 250 or more images. If you outgrow it, move images to Cloudflare R2 or Vercel Blob; only `api/image.js` changes.
- Logins use hashed passwords (bcrypt) and a signed, HTTP-only 14-day cookie.

## Housekeeping
- Neon's free compute sleeps after 5 minutes idle. The first request after a quiet spell can take a second or two longer.
- Passwords cannot be reset by email yet. An admin can add a fresh account, or reset by running `update users set pw_hash = ...` in Neon.
- Neon free plan keeps only a short restore window. Use **Save project** (JSON) on the Sheet tab now and then for an offline backup of important events.
- Check Neon's and Vercel's current free-plan limits on their pricing pages before relying on them.

## Files
- `public/index.html`: the whole front end
- `api/auth.js`, `api/plans.js`, `api/image.js`, `api/_lib.js`: the back end
- `schema.sql`: database tables
- `.env.example`: the two settings you must provide

---

## Staff-only edition (locked)

The app is now served only to signed-in users.

- `public/index.html` is the **sign-in page** (first run: it asks you to create the administrator account).
- `private/app.html` is the **real app**. It is never served as a static file. `api/app.js` checks the session cookie and only then returns it at `/app`. No cookie = redirect to the sign-in page.
- `vercel.json` rewrites `/app` to `/api/app` and bundles the `private/` folder into the function.
- **Company name, logo and watermark** are fixed to "IMPI RMS" for staff accounts. Only the administrator sees the company-name and logo controls.
- **Logo:** add your logo file as `public/impi-logo.png`. It appears on the sign-in page and in every exported title block. Without it the title block shows the company name as text.

### Deploy
Upload the whole folder to GitHub (keep the `api`, `private` and `public` folders and `vercel.json`). Vercel redeploys on its own. Existing accounts, plans and images in Neon are untouched.

Note: branding is locked in the app's interface. It stops staff changing it by accident or habit, not a determined technical user.

## Exhibition / indoor plans, event logo and footer

- **Sheet tab → Plan type & grid**: choose *Indoor / exhibition*, set a grid module (e.g. 3 m). The grid shows on screen and prints on the sheet with lettered columns (A, B, C…) and numbered rows (1, 2, 3…) so there are grid lines between stands. Turn printing/labels off there if not wanted. The Measure tool still works anywhere.
- **Library → Exhibition**: stands (3×3, 6×3, 6×6, 9×6, island 9×9), columns, registration desk, lounge, storage. Stands lock to grid corners when placed. **Number the stands** (Sheet tab) numbers them row by row.
- **Shade cloth** keeps its green banded look; the plain solid black line is a separate style (Plain black line). A line-style selector appears in the toolbar when the Fence tool is active.
- **Event logo**: Sheet tab → Upload event logo. It prints at the top of the right-hand panel with the event details below it.
- **Footer**: logos and company details come from `public/brand.json`. Put your logo files in `public/` (`impi-logo.png`, `logo-2.png`, `logo-3.png`; missing files are skipped) and replace every `[PLACEHOLDER]` in `brand.json` before issuing plans.

## Internal layouts (tent / VIP area)

1. Draw the outline with **Line / fence → Plain black line** (a thin black line, also closable).
2. Select it, then in the toolbar View box choose **+ New internal layout…** and name it. The outline joins the layout.
3. You are now in "Internals only": the aerial underlay and the rest of the site are hidden, new items belong to that layout, and Fit/legend/scale/export use only that layout (sheet title shows "<name> – internal layout").
4. Switch the View box back to **Whole plan** to see everything together. Sheet tab → Internal layouts has rename, delete, and add/remove selected items.

## Safety sign images and evacuation plan

- Assembly point, hose reel, fire extinguisher, first aid, no smoking and emergency exit signs now use the supplied sign artwork (embedded in the app, no extra files). A mirrored exit sign is available. The Defibrillator (AED) sign was removed; it belongs to the medical tent. Older plans containing an AED sign simply no longer draw it.
- **Evacuation** (toolbar button, or Sheet tab → Emergency evacuation) switches to the separate emergency evacuation plan: structures fade, and exits, assembly point, first aid and fire equipment stand out.
- **Generate evacuation routes** draws green arrowed routes from every zone, tent, stage, stall and stand to its nearest exit (Exit / Emergency exit / Entrance doors; exit signs if there are no doors), routing around structures, walls and fences, then on to the Assembly point sign if one is placed. Re-run it after changing the layout; Clear routes removes them. Routes only appear in the evacuation plan and export as their own sheet ("EMERGENCY EVACUATION PLAN"). Works inside internal layouts too.
- Routes are shortest clear walking paths, indicative only. Verify exit widths and capacity.

## Evacuation routing and 1 m grid (update)

- Routes now start at the edge of each tent/stage/stall/stand (not its centre), go to the **nearest exit and an alternate (second-nearest, dashed)**, then on to the assembly point. Big zones that just contain other structures are skipped. Options in the evacuation bar: alternate route on/off, entrances count as exits on/off.
- Fine grid every **1 m** (Sheet tab → Plan type & grid), drawn over the aerial and printed when it is legible at the sheet scale. Stand module lines (e.g. 3 m) are bolder and carry the A/B/C, 1/2/3 labels. Default snap is now 1 m.

## Internal layout per structure

- Click a tent, zone, shape or closed outline and press **Internal layout** in the bar that appears (also in the Selected tab). It opens that structure on its own: its outline, a grid starting at its corner, its own legend, scale and sheet. Add everything inside it as normal.
- A bar at the top of the plan shows **Back to whole plan**, **Download PNG** and **Download PDF** for the layout you are in. Files are named with the layout name.
- Sheet tab → Internal layouts: **Download all layouts (one PDF, one page each)** or **each as PNG**.
- Downloads now save directly to the computer's Downloads folder on the deployed site.

## Front (orange edge) and facing

- Stages, screens, stalls, stands, marquees/tents, bars, FOH, registration desk, first aid, JOC and toilets now show an **orange front edge** (the stage style). Change it per item in Selected → Front side (Top/Right/Bottom/Left/None/Default). Toggle all of them in Sheet tab → "Show the orange front edge".
- Select one or many structures, then use **Face up/right/down/left**, **Face towards a point / structure…** (tap the stage and every selected item turns to face it) or **Match the first selected**. The front edge, not the shape, is what gets aimed.

## Footer, name and watermark (update)

- The sheet footer is **fixed in the app** (not editable by staff): IMPI RMS, 10 Kosmos Crescent, Rynoue AH, Roodeplaat, Tel 012 543 0640, info@impi-secure.co.za, www.impi-secure.co.za, "Event Safety & Security". No PSIRA or registration number. To change it, edit `BRAND_FOOT` near the top of `private/app.html`. `public/brand.json` is no longer used.
- The footer shows the logo file `public/impi-logo.png`.
- The diagonal watermark is **off by default**. Sheet tab → "Add a diagonal draft watermark" turns it on for drafts.

## Update: footer logo, any-file logos, shade netting, evacuation v3
- `public/impi-logo.png` is the IMPI tri-circle logo, used in the sheet footer and on the login page. Replace the file to change it.
- Event logo and admin company logo accept any image (PNG, JPG, SVG, WebP, GIF, BMP, TIFF, HEIC where the browser supports it) or a PDF (first page). Files are downscaled automatically.
- New library item **Stage & AV → Shade netting (open underneath)**: drawn as light hatched netting, never blocks evacuation routes and is never an evacuation start. Use it instead of a Zone.
- Evacuation generator: routes follow aisle centres (clearance-weighted, orthogonal), touching stands are grouped into blocks (one route per block), branches merge into shared trunks, and with "use every exit" ticked the blocks are shared out so every exit/entrance is used. Alternate routes were removed.

## Update: satellite map picker
- **Images tab → + Satellite map** (and the first button on the welcome screen). Search an address/venue, or paste coordinates or a full Google Maps link, pan/zoom so the site is inside the orange frame (it shows the real size in metres), choose Detail, then "Insert this area on the plan". The image is stitched from map tiles and inserted already calibrated (true scale), north up.
- Sources: **Mapbox Satellite** (sharper; needs a public token) and **Esri World Imagery** (works with no token, max zoom 19).
- **Mapbox token (recommended):** create a free account at mapbox.com, copy the *public* token (starts `pk.`). In Vercel → Project → Settings → Environment Variables add `MAPBOX_TOKEN` = that token, then redeploy. Optionally, in Mapbox restrict the token to your domain (URL restrictions). Without the variable, any user can click "Add Mapbox token" in the map picker (stored in that browser only).
- The imagery credit is printed automatically as a line in the sheet footer. Keep it on submissions.
- Imagery can be months or years old; confirm it matches the site before submitting. Uploading your own aerial/drone image still works (+ Upload aerial).
- Leaflet 1.9.4 is bundled in `public/vendor/` (BSD licence), no extra CDN needed.

## Update: stand numbering by row / column
Exhibition → **Number the stands** now offers: lettered rows (A1, A2… then B1…), lettered columns, numbered rows/columns (1-1, 1-2… 2-1…), or continuous numbering row-by-row / column-by-column. Choose which edge starts first (top/bottom row, left/right column), which end the numbers run from, a prefix (e.g. HALL-), separator, first letter, start number and digit padding. A live preview shows the result. Select a block of stands first to number just that block (own prefix/letters); otherwise all stands on the plan are numbered. Rows/columns are detected by stand edge, so mixed stand sizes that line up on the module grid stay in the same row.

## Update: tracing over a venue PDF
- Multi-page PDFs: importing a PDF now shows a page picker with thumbnails. Add other pages later with "+ Another page of …" in the Images tab. Pages render at up to ~5200 px for crisp linework.
- **Snap lines** (toolbar): while drawing lines, shapes, zones or measuring, the cursor snaps to the lines and corners of an imported plan (corners take priority). Toggle it off if you want plain grid snapping.
- Calibrate accepts units: type `107900 mm`, `107.9 m` or `107.9`.
- Printed scale now has "Page was reduced from A3/A2/A1/A0". Venue PDFs are often shrunk onto A4, so the printed 1:500 is not true on the page; calibrating on a dimension line is the reliable method.
- **Set grid start by tapping the plan** (Sheet tab → exhibition module grid): tap the hall corner and the stand grid, snapping and A/B/C labels start from it.
- Typical workflow: import page → Calibrate on a dimension → trace the hall with Plain black line (wall) → add pillars (Library → Column) and doors → set grid start at the hall corner → place and number stands → hide the plan (Images → Hide) or keep it faint for export.

## Update: work on a client's existing plan
- Images tab → on an imported plan, **Edit this plan**: shows the plan at full strength as the drawing you annotate (prints as the sheet background), switches the fine grid off. Click again to return it to a faint tracing background.
- **Library → Plan editing → Cover patch**: a white box that hides part of the client's plan (old notes, wrong symbols). It stays solid on the evacuation plan and is not counted in the legend.
- Add exits with Library → Doors (Exit / Emergency exit) wherever you need them, then use Evacuation.
- **Evacuation → "follow imported plan"** (on by default when a plan is imported): the plan's lines (walls, stands, text, symbols) become obstacles, and routes run along its aisles from the far ends toward the exits, using every exit. Needs: the plan calibrated, the hall outline traced (Line / fence → Plain black line, closed, or a Zone), and exit doors placed. "Few / Normal / Many routes" sets how densely the aisles are covered. Open halls with no aisles get one approach line per exit.
- Check the result against the plan: very faint lines are not seen as walls, and gaps in drawn walls can let routes leak; trace over any such gap with a plain line.

## Update: wall styles, dog-leg exits, green EXIT sign
- New line styles (Line / fence dropdown, or Style in the Selected tab): **Thin line (hairline)**, **Brick wall (hatched)** and **Shell scheme wall** (double line with a panel joint every 1 m). The existing plain line, wall and fence are unchanged. All three count as walls for evacuation routes.
- **Dog-leg exit**: select a wall line, press "Add dog-leg exit in this wall…", tap the spot on the wall, set passage width, runs and jog, and choose whether to add an emergency exit door. The wall is cut and the offset passage walls are added in the same style. Evacuation routes go through it. Undo removes it.
- New sign "EXIT sign (green box, white text)" in the Signs library. It is kept at full strength on the evacuation plan. The old exit signs remain.

## Update: draping, black shade cloth, ablutions, decking, domes
- Line styles: **Black draping**; shade cloth is now **green** or **black**.
- Library, Services: Portable toilet + wash basin, Wash basin, Hand-wash station (3 basins), Communal urinal (4 / 6 users), Ablution trailer (6 cubicles), Accessible (disabled) ablution trailer.
- Library, Stage & AV: Decking 3×3, 6×3, 6×6, 9×9 (1.22 m panel grid) and Shade netting in black.
- Library, Tents: Dome tent 8.3 × 8.3 m (Crossover L, 68 m², from the supplied spec sheet) and a Small dome 5 × 5 m. Place the deck first, then the dome on top; items draw in the order they were placed.
- Signs: Accessible / disabled facility.

## Update: crowd & capacity, event times, editable evacuation routes, sign-in page
- Sheet tab → "Event times & crowd": start/end time, expected attendance, exit flow rate (default 82 people/min/m), target clearance time (default 8 min) and editable space-per-person figures. These are planning defaults, not legal limits.
- The sheet's right-hand panel now shows Event times, Expected attendance and a CROWD & CAPACITY block (planned capacity vs attendance, capacity per structure, open ground estimate, exit width, clearance time). On an internal-layout sheet it shows that structure's capacity only.
- Each zone / tent / dome has a "Crowd capacity" section in the Selected tab (usage, own density, fixed headcount, leave out). With an internal layout, furniture is deducted from the usable floor and table seats are counted when "Seated at tables" is chosen.
- "Crowd & capacity calculation…" (Sheet tab or Evacuation bar) shows the full table, including exit width per structure and warnings for double counting.
- Evacuation routes: select any route to edit it (drag points, add/remove points, reverse direction). "Draw a route" adds your own, "Lock / unlock routes" and the per-route "Keep" tick stop Generate from replacing them.
- Sign-in page: if you are already signed in it now says so and offers Open / Sign out instead of redirecting at once.

## Update: saving that cannot lose work
- Auto-save now keeps the whole session on the device in IndexedDB (plan, settings, cloud plan id **and the background images**), in addition to the old localStorage copy. Refresh, crash or closed tab: reopen and everything is back, including "Edit this plan" and calibration.
- Cloud and project-file saves now also keep the "Edit this plan" flag and PDF details of each background.
- Cloud save is verified: after saving, the revision is read back and compared. If it fails, a backup .json file is downloaded automatically.
- A status chip in the header shows "Unsaved changes" / "Saved to cloud #n hh:mm" / "Backup file saved"; the browser warns before closing with unsaved changes.
- An expired sign-in no longer throws you off the page when there is work on screen: sign in again (Sheet tab, Cloud) and save.
- Note: browser copies are per device. Clearing site data removes them; the cloud revisions and .json files are the permanent record.

## DXF import / export (AutoCAD, BricsCAD, LibreCAD)

**Import** (Plan editing → Import DXF): pick a .dxf; units are auto-detected from the file (override if wrong). Choose how to bring it in: *Underlay* (to-scale background to trace over), *Editable* (lines become editable plan lines), or *Both*. Untick layers you don't want (dimensions, hatching, furniture clutter). Far-away stray objects are ignored when sizing. Supported entities: LINE, LWPOLYLINE/POLYLINE (incl. arcs), CIRCLE, ARC, ELLIPSE, SPLINE, SOLID/3DFACE, TEXT/MTEXT, INSERT (blocks, scaled/rotated/arrays), DIMENSION. Not read: hatches, 3D solids, embedded images.

**Export** (Export → DXF): choose mm or m. Writes AutoCAD R2000 DXF with layers named FPS-* (stands, tents, stage, furniture, services, lines by style, doors, signs, text, dimensions, zones, labels) and an info block below the drawing. Background images are not exported.

**DWG import**: supported (LibreDWG reads R13 to 2018; only 2004 format tested here) via LibreDWG compiled to WebAssembly (`public/vendor/libredwg/`, ~9.5 MB, loaded only when a DWG is opened). The DWG is converted to DXF in the browser and then follows the normal import dialog. Tested on a real 1 MB AutoCAD 2004 client tech plan (27 layers, ~10,000 lines/shapes, converts in ~2 s). **DWG export is not possible** (no open DWG writer): export DXF, then in AutoCAD use Save As → DWG, or send the DXF.

**Licence note**: LibreDWG is GPL-3.0 (see `public/vendor/libredwg/`). Fine for internal staff use; talk to a lawyer before redistributing the app to third parties.

## Approval readiness check

Sheet tab (and the "Before you submit" block in the Export area) → **Approval readiness check…**. Lists what to FIX, REVIEW, and what passes, each with a Show button that jumps to the objects on the plan, and a downloadable HTML report.

Checks: attendance/times entered; background images calibrated; capacity vs attendance; number of exits, minimum exit width, total exit width vs attendance (flow rate and target time from the Sheet tab); per structure: exits present, 2+ exits above a headcount, exit width for its capacity, straight-line distance to nearest exit, fire extinguishers by area, first aid nearby by headcount; first aid on plan; assembly point present, not inside a structure, minimum distance from structures; exit signs at exits; tent/marquee spacing (including touching/overlapping).

All limits are editable under "Settings used by this check" and are stored with the plan (`S.meta.rdy`). Defaults are planning starting points, NOT legal limits: confirm with SANS 10400, the risk category and your ESSPC / fire department. Distances are straight lines.

## Working on the app (source layout, tests, safe deploys)

`private/app.html` is now a **generated file**. Do not edit it by hand. The source lives in `src/app/` as small numbered parts (styles, page markup, then one file per feature: `42-crowd-capacity.js`, `43-readiness-check.js`, `44-evacuation-routes.js`, `59-dxf-dwg.js`, `60-cloud.js` …). They are joined in file-name order, inside the same single closure as before, so behaviour is identical. The first build was verified byte-for-byte identical to the previous single-file app.

```
node build.mjs            # rebuild private/app.html from src/app
node build.mjs --check    # fail if private/app.html is out of date
```

**Tests** (headless Chromium, no cloud needed):
```
npm test                                   # installs the test tools once, then runs everything
DWG_FIXTURE=/path/plan.dwg npm test        # also tests DWG import on a real file (not shipped: client files stay private)
node tests/smoke-live.mjs https://impi-floorplan-studio.vercel.app   # after every deploy
```
They check: the app builds and matches the source; server code parses; vendor files present; app loads without script errors; undo/redo; crowd maths; readiness check flags a bad plan and passes a good one; evacuation routes generate; DXF export is well formed and round-trips to the same size; DXF import is to scale; objects and backgrounds survive a reload; (optional) DWG import. `.github/workflows/test.yml` runs them on every push if the project is on GitHub.

**Release routine:** change `src/app/…` → `npm test` → commit (including the rebuilt `private/app.html`) → push → `node tests/smoke-live.mjs <url>` → open the site, sign in, save and reopen one plan.

## Dog-leg exits (updated)
Line / fence → select the wall → Dog-leg, then tap the wall. Choose **Use**: *Building / hall wall* (1.5 m passage, short runs) or *Festival fence line* (3 m passage, 3 m runs and jog; edit any number). **Corners**: *Square, 90° turns* (default) or *Angled 45°*. **Door / gate at the end**: Emergency exit, Exit, Entrance or none (open passage).

## Gazebos
Library → Tents → Gazebo 3 × 3 and Gazebo 3 × 6 (two bays). Counted as structures for capacity and fire equipment. Readiness check uses a separate, smaller minimum gap between two gazebos (default 1.5 m, editable) so rows of gazebos are not flagged like marquees.

## Trussing
Library → Stage & AV: Truss frame 3×3, 4×4, 6×4, 6×6 and Truss run 3 m / 6 m (sizes editable under Selected). Or Line / fence → style **Truss** to draw any run or frame (width 0.3 m, set per line). Drawn to scale as double rails with bracing and corner towers; open underneath, so it does not count as floor space for capacity and does not block evacuation routes. Exports to DXF on layer FPS-TRUSS (library frames on FPS-STAGE-AV).

## Crowd: event site boundary and open-sided structures
- **Event site boundary:** open ground is only counted inside a boundary. Crowd & capacity → *Draw event boundary now*, tap around the whole event, Finish. (Or select any Shape / closed line and tick *Event site boundary*.) Open ground = site area minus the floor space of structures inside it, at the "Open ground" density (editable, Sheet tab). Without a boundary the crowd figure covers structures only, and the Crowd table, legend and readiness check say so. Older plans that had a closed perimeter line keep working.
- **Venue already has fencing (don't want to draw it):** type the total event area in m² under Crowd & capacity (or Sheet tab → *Event site area*). Open ground = that area minus the floor space of all structures, at the Open-ground density. A drawn boundary, if there is one, takes priority.
- **Certified capacity:** enter the venue's fitness-certificate figure (Crowd & capacity, or Sheet tab). The plan's total is never allowed above it, and attendance over it fails the readiness check.
- **Open-sided structures:** Bedouin tents and gazebos are open-sided by default; tick *Open-sided structure* on any structure to change it. They are not checked for exits (none required, exit width, travel distance) and are shown as "open sides" in the capacity table. Decks, shade netting and truss were never structures for exits. Fire equipment and first aid rules still apply.

## Straightening the satellite map
In the satellite map window, use **Straighten (°)** (slider or number). A grid appears inside the orange frame: turn it until its lines run along a fence, road or building edge, then Insert. The plan is inserted rotated so those lines are straight (true scale kept). You can still fine-tune afterwards under Layers → Rotate (°).

## Redrawing a venue from its plan (Pencil, loupe, Ortho, Venue)
- **Calibrating:** Layers → *Calibrate*, tap the two ends of a dimension on the plan, then type its value exactly as printed: `80600` (plain numbers over 300 are millimetres), `80600 mm`, `80.6 m` or `80,6 m`. (An earlier build could not read these; fixed. Calibrate with the longest dimension on the plan for the best accuracy, then check another known distance with Measure.)
- **Sharpen lines:** each imported plan has *Sharpen lines (crisp, for tracing)*: paper goes transparent and the lines are made solid, so tracing is clear even on a blurry scan. Saved plans now keep more detail (up to 4400 px, higher JPEG quality).
- **Pencil:** toolbar *Pencil* is the line tool with exact snapping. Corners and line ends snap first; otherwise the point slides along the centre of the nearest line. A magnifier (loupe) shows the exact point; on a phone one finger drags the cursor (two fingers pan and zoom). Use *Shape* for buildings.
- **Ortho:** keeps each segment horizontal or vertical along the plan's own axes (follows a rotated plan).
- **Detect fire equipment & exits:** Layers → *Detect fire equipment & exits* scans the (calibrated) plan for red, green and yellow markers and places real extinguisher, EXIT sign and electrical items on them after you confirm. The red legend box on a page is ignored. Check the result: a red marker may be a hose reel.
- **Venue (permanent features):** toolbar *Venue*. Turn on "Everything I draw now is part of the venue", mark/unmark selected objects, lock them, then *Start new event from this venue* to keep only the venue and clear the event details (it saves as a separate plan).
- **EXIT sign:** Library → Safety signs → *EXIT sign (standard green, white text)*.

## Stanchions, ropes and poles (exhibitions and outdoor VIP)
- **Line / fence** → style: *Stanchion & rope* (chrome posts, red rope), *VIP velvet rope* (gold posts, red rope), *Retractable belt barrier* (black posts, belt) or *Rope & timber poles* (outdoor / VIP). Posts are drawn at every corner and at a set spacing (Selected → *Post spacing*, default 2 to 2.5 m); colour and weight are editable. Close the shape for a full enclosure.
- **Ready-made enclosures** (Library): *VIP rope enclosure 4 × 4* and *8 × 5* (Exhibition), *Stanchion & rope enclosure 3 × 3*, and *Outdoor VIP rope & pole area 10 × 6* (Tents). Each has a gap for the entrance, resizes like any item, and the outdoor one counts as an open-sided area for crowd capacity.
- Ropes and belts are not treated as solid barriers for evacuation routes (they are unclipped in an emergency). Use a Crowd barrier or Fence where a physical barrier is required.

## Perimeter line with gaps, boom gate, sliding gate, stairs

- **Perimeter** (toolbar): tap along an existing fence. Where the fence stops, press **Gap**, then tap where it starts again. The gap is drawn dashed and labelled G1, G2 … with its width. Tap the first point (or Finish) to close the loop. Each section shows its length.
- The **legend** gets a Perimeter block: fenced length, each gap, total gaps, total perimeter including gaps, and the enclosed area if closed.
- Select a perimeter to switch section lengths on/off, or remove all gaps. Dragging, adding or deleting points keeps the gaps in the right place. DXF/DWG export writes each fenced stretch as its own polyline.
- Gaps are not treated as barriers by the evacuation route generator.
- **Library > Site & access**: boom gate 4.5 / 6.5 m, sliding gate 4 / 6 m opening (shows the open position dashed), stairs in three sizes. They are visual only: they do not block routes, count as floor space, or count as exits. Put an Exit door in an emergency-exit opening.

## Clear project (Sheet tab)

Top of the Sheet tab: **Clear project (blank)** wipes objects, background images, event details, crowd inputs and layouts for the next redraw (company, logo and paper size stay). It asks for a second click to confirm, and Undo restores it. **Clear event only (keep venue)** appears when you have venue-permanent items and keeps them.

## Stand layout: name, size, number

Exhibition stands now show the **stand name** top-left (optional, typed later under Selected > Stand name), the **size** (for example 3x3) bottom-left and the **stand number** bottom-right. Auto-numbering fills the number as before; the name stays empty until you type it. Small stands drop the parts that do not fit.

## Stand names after numbering

Number the stands as before. Later, on the Sheet tab, press **Stand names…** to see every stand in number order with a box for its name. Type names in, or paste a list (one per line, in number order), then Save. Tap a stand number to jump to it on the plan. Blank = no name.

## Auto-trace venue shell

Images tab, on a calibrated plan: **Auto-trace venue shell**. It builds the bare venue as editable venue lines: the outer outline of the building(s), plus the long straight internal walls (double lines become one centre line, wall ends are squared onto crossing walls, dashed structural grid lines and text are ignored). Settings: bridge openings up to X m (doors in the outer wall), ignore attachments narrower than X m (leader lines, boxes), shortest wall to keep. One Undo removes the whole result. Furniture, symbols and curves are not traced; use Pencil and Detect for those.

Auto-trace tip: with "Heavy lines only" ticked, walls drawn in thin lines (event stands, stages, furniture on a client's layout plan) are skipped and only the heavier building walls are kept. Untick it on a scanned plan where every line is thin.

## Venue library (save once, start every event from it)

1. Import the venue plan, calibrate, press **Auto-trace venue shell** (with "Heavy lines only" ticked it traces the whole structure: outline, annexes beside the building and the heavier walls, and leaves stands, text, grid and furniture alone). Fix any corners, add Detect/Pencil items (fire equipment, exits), all marked as venue.
2. Toolbar **Venue** > **Save as venue**. Stored in the cloud by venue name as "VENUE: <name>", venue objects locked, event details and crowd inputs blank. Saving again with the same venue updates it.
3. For each event: **Venue** > **Start new event from a saved venue…**, pick the venue. It opens with the venue locked in place and blank event details; add the event layout. It saves as its own plan, and the venue is never overwritten.

## Fight cage, ring and round stages (Library > Stage & AV)

MMA octagon cage 9.1 m and 7.3 m (platform included, two door gaps, corner posts), boxing / K-1 ring 6.1 m and 7.3 m (ropes, red / blue / white corner posts, neutral-corner steps), round stage 6 m and 8 m, and a catwalk / runway. The size in each name is the cage or rope size; the placed footprint is the platform. They count as structures: they take floor space in the crowd figure and block evacuation routes. Resize under Selected to match the supplier's spec.
