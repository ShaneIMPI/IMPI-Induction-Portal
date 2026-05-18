# IMPI Portal Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the IMPI Induction Portal with group induction up to 35 members (+ inductor cert), duplicate registration prevention, and an enhanced admin completions search — all tested locally before deploying.

**Architecture:** Pure HTML/JS/CSS frontend in `public/`, Netlify Functions backend in `netlify/functions/`, Supabase as the database. No build step — changes to files in `public/` are immediately live on `netlify dev`. The new `check-duplicate.js` function is auto-discovered by Netlify — no config changes needed.

**Tech Stack:** Vanilla HTML/JS/CSS, Netlify Functions (Node.js), Supabase JS client v2, Resend (email)

**Testing approach:** No test framework. Each task ends with a browser verification step at `http://localhost:8888` (run `cd ~/impi-portal && netlify dev` once, leave it running throughout all tasks).

---

## Pre-flight: Start local server

```bash
cd ~/impi-portal
netlify dev
```

Leave this running in a terminal tab. All verification steps below use `http://localhost:8888`.

---

## Task 1: Create `check-duplicate.js` netlify function

**Files:**
- Create: `netlify/functions/check-duplicate.js`

- [ ] **Step 1: Create the file**

```javascript
// netlify/functions/check-duplicate.js
const { db, ok, err, cors } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const { fullName, surname, eventId, idNumber } = JSON.parse(event.body || '{}');
  if (!fullName || !surname || !eventId) return err('Missing required fields');

  const supabase = db();
  const { data, error } = await supabase
    .from('completions')
    .select('cert_code, id_number')
    .eq('event_id', eventId)
    .ilike('full_name', fullName)
    .ilike('surname', surname);

  if (error) return err(error.message);
  if (!data || data.length === 0) {
    return ok({ isDuplicate: false, hasSameId: false, existingCode: null });
  }

  const sameId = data.find(r => r.id_number === idNumber);
  if (sameId) {
    return ok({ isDuplicate: true, hasSameId: true, existingCode: sameId.cert_code });
  }
  return ok({ isDuplicate: true, hasSameId: false, existingCode: null });
};
```

- [ ] **Step 2: Verify the function loads**

In a second terminal:
```bash
curl -s -X POST http://localhost:8888/.netlify/functions/check-duplicate \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test","surname":"User","eventId":"nonexistent","idNumber":"123"}'
```
Expected response: `{"isDuplicate":false,"hasSameId":false,"existingCode":null}`

- [ ] **Step 3: Commit**

```bash
cd ~/impi-portal
git add netlify/functions/check-duplicate.js
git commit -m "feat: add check-duplicate netlify function for registration fraud prevention"
```

---

## Task 2: Update `complete.js` for group email

**Files:**
- Modify: `netlify/functions/complete.js`

This adds `group_count` support so the inductor's email subject and body reflect the group context.

- [ ] **Step 1: Add `group_count` extraction after line 34** (`const is_group = ...`)

Find this line:
```javascript
  const is_group = body.is_group || body.isGroup || false;
```

Add below it:
```javascript
  const group_count = parseInt(body.group_count || body.groupCount) || 0;
```

- [ ] **Step 2: Update the `sendCertEmail` call around line 74**

Find:
```javascript
      await sendCertEmail({ ...record });
```

Replace with:
```javascript
      await sendCertEmail({ ...record }, group_count);
```

- [ ] **Step 3: Update the `sendCertEmail` function signature and content**

Find:
```javascript
async function sendCertEmail(comp) {
```

Replace the entire function with:
```javascript
async function sendCertEmail(comp, groupCount = 0) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !comp.email) return;

  const resend = new Resend(apiKey);
  const verifyUrl = `https://impi-inductions.netlify.app/verify?code=${comp.cert_code}`;

  const subject = groupCount > 0
    ? `Your IMPI Safety Induction Certificate (+${groupCount} team certificate${groupCount !== 1 ? 's' : ''})`
    : 'Your IMPI Safety Induction Certificate';

  const groupNote = groupCount > 0
    ? `<p style="color:#374151;font-size:14px;line-height:1.6;margin-bottom:16px">
        You and <strong>${groupCount} team member${groupCount !== 1 ? 's' : ''}</strong> have completed the induction.
        Each team member's certificate was saved individually.
      </p>`
    : '';

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'IMPI Safety Services <noreply@impisafety.co.za>',
    to: comp.email,
    subject,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#d42b2b;padding:24px 32px;display:flex;align-items:center;gap:12px">
          <div style="font-family:Arial,sans-serif;background:rgba(255,255,255,0.15);padding:6px 12px;border-radius:6px;color:#fff;font-size:18px;font-weight:bold">IMPI</div>
          <div>
            <div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Safety Induction Certificate</div>
            <div style="color:#fff;font-size:14px;font-weight:600">Proof of Completion</div>
          </div>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:15px;margin-bottom:24px">Hi <strong>${comp.full_name} ${comp.surname || ''}</strong>,</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin-bottom:24px">
            Your safety induction has been successfully completed. Please save or print this certificate and present it at the venue entrance.
          </p>
          ${groupNote}
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px">Certificate Code</td></tr>
              <tr><td style="padding:0 0 12px;font-size:22px;font-weight:800;font-family:monospace;color:#d42b2b;letter-spacing:3px">${comp.cert_code}</td></tr>
              <tr><td style="padding:6px 0;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px">Name</td></tr>
              <tr><td style="padding:0 0 12px;font-size:14px;font-weight:600;color:#111">${comp.full_name} ${comp.surname || ''}</td></tr>
              <tr><td style="padding:6px 0;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px">Company</td></tr>
              <tr><td style="padding:0 0 12px;font-size:14px;color:#374151">${comp.company || '—'}</td></tr>
              <tr><td style="padding:6px 0;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px">Completed</td></tr>
              <tr><td style="padding:0;font-size:14px;color:#374151">${new Date(comp.completed_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
            </table>
          </div>
          <a href="${verifyUrl}" style="display:inline-block;background:#d42b2b;color:#fff;font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
            ✓ Verify Certificate
          </a>
          <p style="color:#9ca3af;font-size:12px;line-height:1.5">
            This certificate was issued by IMPI Safety Services International. Questions? Contact us at <a href="mailto:info@impisafety.co.za" style="color:#d42b2b">info@impisafety.co.za</a>
          </p>
        </div>
      </div>
    `
  });
}
```

- [ ] **Step 4: Verify single induction email still works**

In the browser at `http://localhost:8888/induction`, complete a test induction for one person with a real email. Check the email arrives with subject "Your IMPI Safety Induction Certificate" (no group suffix).

- [ ] **Step 5: Commit**

```bash
cd ~/impi-portal
git add netlify/functions/complete.js
git commit -m "feat: add group_count support to complete.js for group induction email subject"
```

---

## Task 3: Update group size dropdown and CSS in `induction.html`

**Files:**
- Modify: `public/induction.html`

Three sub-changes: dropdown HTML (2–35, new label), CSS for 5-column member grid, JS to populate dropdown on load.

- [ ] **Step 1: Update the dropdown HTML**

Find (lines 239–249):
```html
  <div id="groupSizeWrap" style="display:none;margin-bottom:20px">
    <div class="fg">
      <label data-i18n="lbl_group_size">Number of team members</label>
      <select id="groupSize" onchange="buildGroupForm()">
        <option value="">— Select —</option>
        <option value="2">2</option><option value="3">3</option><option value="4">4</option>
        <option value="5">5</option><option value="6">6</option><option value="7">7</option>
        <option value="8">8</option><option value="9">9</option><option value="10">10</option>
      </select>
    </div>
    <div id="groupMembersForm"></div>
  </div>
```

Replace with:
```html
  <div id="groupSizeWrap" style="display:none;margin-bottom:20px">
    <div class="fg">
      <label data-i18n="lbl_group_size">Number of additional team members (excluding yourself — the inductor)</label>
      <select id="groupSize" onchange="buildGroupForm()">
        <option value="">— Select —</option>
      </select>
    </div>
    <div id="groupMembersForm"></div>
  </div>
```

- [ ] **Step 2: Update the English translation key for `lbl_group_size`**

Find in the TRANSLATIONS.en object (around line 609):
```javascript
    lbl_group_size:'Number of team members', btn_next:'Next →',
```

Replace with:
```javascript
    lbl_group_size:'Number of additional team members (excluding yourself — the inductor)', btn_next:'Next →',
```

- [ ] **Step 3: Add CSS for the 5-column member grid**

Find (around line 87–89):
```css
/* GROUP MEMBERS */
.member-row{background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:10px;}
.member-num{font-family:var(--fh);font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--red);margin-bottom:10px;}
```

Replace with:
```css
/* GROUP MEMBERS */
.member-row{background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:10px;}
.member-num{font-family:var(--fh);font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--red);margin-bottom:10px;}
.member-grid{display:grid;grid-template-columns:1fr 1fr 140px 1fr 1fr;gap:10px;align-items:end;}
@media(max-width:700px){.member-grid{grid-template-columns:1fr 1fr;}}
@media(max-width:400px){.member-grid{grid-template-columns:1fr;}}
```

- [ ] **Step 4: Add JS to populate the dropdown on page load**

Find the `// ── STATE ──` block at the top of the `<script>` section (around line 529):
```javascript
let currentEvent = null;
let inductionType = 'individual';
```

Add after the state declarations block (after `let currentStep = 0;` and similar lines, before the first function definition):
```javascript
// Populate group size dropdown 2–35
(function() {
  const sel = document.getElementById('groupSize');
  for (let n = 2; n <= 35; n++) {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  }
})();
```

- [ ] **Step 5: Verify in browser**

1. Go to `http://localhost:8888/induction`
2. Select Group / Team
3. Open the dropdown — confirm options run from 2 to 35
4. Label should read "Number of additional team members (excluding yourself — the inductor)"

- [ ] **Step 6: Commit**

```bash
cd ~/impi-portal
git add public/induction.html
git commit -m "feat: expand group size dropdown to 35, add 5-col member grid CSS, update label"
```

---

## Task 4: Update `buildGroupForm()` and `getGroupMembers()` in `induction.html`

**Files:**
- Modify: `public/induction.html`

- [ ] **Step 1: Replace `buildGroupForm()`**

Find:
```javascript
function buildGroupForm() {
  const n = parseInt(document.getElementById('groupSize').value);
  if (!n) return;
  document.getElementById('btn0next').disabled = false;
  const wrap = document.getElementById('groupMembersForm');
  wrap.innerHTML = Array.from({length:n}, (_,i) => `
    <div class="member-row">
      <div class="member-num">Member ${i+1}</div>
      <div class="two">
        <div class="fg"><label>First Name *</label><input type="text" id="gm${i}_name" placeholder="First name"/></div>
        <div class="fg"><label>Surname *</label><input type="text" id="gm${i}_surname" placeholder="Surname"/></div>
      </div>
      <div class="two">
        <div class="fg"><label>ID / Passport *</label><input type="text" id="gm${i}_id" placeholder="ID number"/></div>
        <div class="fg"><label>Trade *</label><input type="text" id="gm${i}_trade" placeholder="Trade / occupation"/></div>
      </div>
    </div>`).join('');
}
```

Replace with:
```javascript
function buildGroupForm() {
  const n = parseInt(document.getElementById('groupSize').value);
  if (!n) return;
  document.getElementById('btn0next').disabled = false;
  const idOpts = `
    <option value="">Type...</option>
    <option value="SA ID">🇿🇦 SA ID</option>
    <option value="Passport">🌍 Passport</option>
    <option value="NIN">🇳🇬 NIN</option>
    <option value="National ID">🇰🇪 National ID</option>
    <option value="Employee No">🏢 Employee No</option>
    <option value="Other">📋 Other</option>`;
  const wrap = document.getElementById('groupMembersForm');
  wrap.innerHTML = Array.from({length: n}, (_, i) => `
    <div class="member-row">
      <div class="member-num">Team Member ${i + 1}</div>
      <div class="member-grid">
        <div class="fg"><label>First Name *</label><input type="text" id="gm${i}_name" placeholder="First name"/></div>
        <div class="fg"><label>Surname *</label><input type="text" id="gm${i}_surname" placeholder="Surname"/></div>
        <div class="fg"><label>ID Type *</label><select id="gm${i}_id_type">${idOpts}</select></div>
        <div class="fg"><label>ID Number *</label><input type="text" id="gm${i}_id" placeholder="ID number"/></div>
        <div class="fg"><label>Trade *</label><input type="text" id="gm${i}_trade" placeholder="Trade / occupation"/></div>
      </div>
    </div>`).join('');
}
```

- [ ] **Step 2: Replace `getGroupMembers()`**

Find:
```javascript
function getGroupMembers() {
  const n = parseInt(document.getElementById('groupSize').value) || 0;
  return Array.from({length:n}, (_,i) => ({
    name: document.getElementById(`gm${i}_name`)?.value.trim() || '',
    surname: document.getElementById(`gm${i}_surname`)?.value.trim() || '',
    id: document.getElementById(`gm${i}_id`)?.value.trim() || '',
    trade: document.getElementById(`gm${i}_trade`)?.value.trim() || ''
  }));
}
```

Replace with:
```javascript
function getGroupMembers() {
  const n = parseInt(document.getElementById('groupSize').value) || 0;
  return Array.from({length: n}, (_, i) => ({
    name:    document.getElementById(`gm${i}_name`)?.value.trim() || '',
    surname: document.getElementById(`gm${i}_surname`)?.value.trim() || '',
    id_type: document.getElementById(`gm${i}_id_type`)?.value || '',
    id:      document.getElementById(`gm${i}_id`)?.value.trim() || '',
    trade:   document.getElementById(`gm${i}_trade`)?.value.trim() || ''
  }));
}
```

- [ ] **Step 3: Add `validateGroupMembers()` immediately after `getGroupMembers()`**

```javascript
function validateGroupMembers(members) {
  const errors = [];
  members.forEach((m, i) => {
    const num = i + 1;
    if (!m.name)    errors.push(`Team Member ${num} needs a First Name`);
    if (!m.surname) errors.push(`Team Member ${num} needs a Surname`);
    if (!m.id_type) errors.push(`Team Member ${num} needs an ID Type`);
    if (!m.id)      errors.push(`Team Member ${num} needs an ID Number`);
    if (!m.trade)   errors.push(`Team Member ${num} needs a Trade`);
  });
  return errors;
}
```

- [ ] **Step 4: Verify in browser**

1. Go to `http://localhost:8888/induction`, select Group, pick 3 members
2. Each row should show 5 fields in one line: First Name, Surname, ID Type (dropdown), ID Number, Trade
3. On a narrow window, they should wrap to 2 columns
4. Row headers should read "Team Member 1", "Team Member 2", "Team Member 3"

- [ ] **Step 5: Commit**

```bash
cd ~/impi-portal
git add public/induction.html
git commit -m "feat: update group member form with 5-field grid, ID type dropdown, validation"
```

---

## Task 5: Add duplicate-check helper, modal HTML, and `showModal()` to `induction.html`

**Files:**
- Modify: `public/induction.html`

- [ ] **Step 1: Add the duplicate modal HTML**

Find, just before `</div><!-- end step-wrap -->` (around line 525):
```html
</div><!-- end step-wrap -->
<div class="toast" id="toast"></div>
```

Add the modal between them:
```html
</div><!-- end step-wrap -->

<!-- DUPLICATE MODAL -->
<div id="dupModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;align-items:center;justify-content:center">
  <div style="background:#fff;border-radius:14px;padding:28px;max-width:440px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.2)">
    <div id="dupModalTitle" style="font-family:var(--fh);font-size:16px;font-weight:900;margin-bottom:8px;color:#111">Notice</div>
    <div id="dupModalBody" style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:20px"></div>
    <div style="text-align:right">
      <button class="btn btn-red" onclick="document.getElementById('dupModal').style.display='none'">OK</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>
```

- [ ] **Step 2: Add `showModal()`, `checkDuplicate()`, and `saveWithRetry()` to the script section**

Find the `// ── CERT CODE ──` comment (around line 1176). Add before it:

```javascript
// ── MODAL ──
function showModal(title, html) {
  document.getElementById('dupModalTitle').textContent = title;
  document.getElementById('dupModalBody').innerHTML = html;
  document.getElementById('dupModal').style.display = 'flex';
}

// ── DUPLICATE CHECK ──
async function checkDuplicate(fullName, surname, eventId, idNumber) {
  try {
    const res = await fetch('/.netlify/functions/check-duplicate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({fullName, surname, eventId, idNumber})
    });
    return await res.json();
  } catch(e) {
    return {isDuplicate: false, hasSameId: false, existingCode: null};
  }
}

// ── SAVE WITH RETRY ──
async function saveWithRetry(payload, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('/.netlify/functions/complete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch(e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Save failed after retries');
}
```

- [ ] **Step 3: Verify modal renders**

Open browser console at `http://localhost:8888/induction` and run:
```javascript
showModal('Test Title', 'Test <strong>body</strong> content')
```
Modal should appear with red OK button. Clicking OK should close it.

- [ ] **Step 4: Commit**

```bash
cd ~/impi-portal
git add public/induction.html
git commit -m "feat: add duplicate check modal, checkDuplicate(), and saveWithRetry() helpers"
```

---

## Task 6: Rewrite `generateCert()` in `induction.html`

**Files:**
- Modify: `public/induction.html`

This is the core change. The new version:
- Checks duplicates for single induction before saving (blocks with modal)
- For group: validates, checks each person, saves inductor first (with group_count for email), then each member (no email), shows progress text

- [ ] **Step 1: Replace `generateCert()`**

Find the entire existing `generateCert()` function (starts at `async function generateCert()`, ends before `function showSingleCert`).

Replace with:
```javascript
async function generateCert() {
  const btn = document.getElementById('btnLegalNext');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  const ev = currentEvent || {id:'DEMO', name:'Event', venue:'—', organiser:'—'};
  const name    = document.getElementById('p_name').value.trim();
  const surname = document.getElementById('p_surname').value.trim();
  const email   = document.getElementById('p_email').value.trim();
  const id      = document.getElementById('p_id').value.trim();
  const idType  = document.getElementById('p_id_type')?.value || 'SA ID';
  const company = document.getElementById('p_company').value.trim();
  const role    = document.getElementById('p_role').value;
  const trade   = document.getElementById('p_trade').value.trim();
  const phone   = document.getElementById('p_phone')?.value?.trim() || '';
  const now     = new Date();
  const completedStr = now.toLocaleDateString('en-ZA', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});

  if (inductionType === 'group') {
    const members = getGroupMembers();

    // Validate all member fields first
    const errors = validateGroupMembers(members);
    if (errors.length) {
      showToast(errors[0], 'error');
      btn.disabled = false;
      btn.textContent = t('btn_generate');
      return;
    }

    const total = members.length + 1; // inductor + N members
    const results = [];
    let certNum = 0;

    function setProgress(n) {
      btn.textContent = `Generating certificate ${n} of ${total}...`;
    }

    // --- Inductor ---
    certNum++;
    setProgress(certNum);
    const inductorDup = await checkDuplicate(name, surname, ev.id, id);
    if (inductorDup.hasSameId) {
      results.push({name, surname, id_type: idType, id, role, company, trade, code: inductorDup.existingCode, alreadyCompleted: true, isInductor: true});
    } else if (inductorDup.isDuplicate) {
      results.push({name, surname, id_type: idType, id, role, company, trade, code: null, fraudBlocked: true, isInductor: true});
    } else {
      const code = makeCertCode(name, id);
      try {
        await saveWithRetry({
          fullName: name, surname, email,
          idNumber: id, idType, company, role, trade, phone,
          eventId: ev.id, certCode: code,
          is_group: true, group_count: members.length
        });
      } catch(e) { console.error('Inductor save failed:', e); }
      results.push({name, surname, id_type: idType, id, role, company, trade, code, isInductor: true});
    }

    // --- Team members ---
    for (const m of members) {
      certNum++;
      setProgress(certNum);
      const dup = await checkDuplicate(m.name, m.surname, ev.id, m.id);
      if (dup.hasSameId) {
        results.push({...m, role, company, code: dup.existingCode, alreadyCompleted: true});
      } else if (dup.isDuplicate) {
        results.push({...m, role, company, code: null, fraudBlocked: true});
      } else {
        const code = makeCertCode(m.name, m.id);
        try {
          await saveWithRetry({
            fullName: m.name, surname: m.surname,
            idNumber: m.id, idType: m.id_type,
            company, role, trade: m.trade, phone,
            eventId: ev.id, certCode: code
            // no email field → backend skips sending email for members
          });
        } catch(e) { console.error('Member save failed:', e); }
        results.push({...m, role, company, code});
      }
    }

    showGroupCerts(results, ev, completedStr);

  } else {
    // --- Single induction ---
    const dup = await checkDuplicate(name, surname, ev.id, id);
    if (dup.hasSameId) {
      showModal('Already Completed',
        `You have already completed this induction. Your certificate code is: <strong style="font-family:monospace;font-size:16px;letter-spacing:2px;color:#d42b2b">${dup.existingCode}</strong>`);
      btn.disabled = false;
      btn.textContent = t('btn_generate');
      return;
    }
    if (dup.isDuplicate) {
      showModal('Duplicate Registration',
        `A person with the name <strong>${name} ${surname}</strong> has already completed this induction with a different ID number. Please verify your identity or contact the safety manager.`);
      btn.disabled = false;
      btn.textContent = t('btn_generate');
      return;
    }

    const code = makeCertCode(name, id);
    try {
      const res = await fetch('/.netlify/functions/complete', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({fullName:name, surname, email, idNumber:id, idType, company, role, trade, phone, eventId:ev.id, certCode:code})
      });
      const data = await res.json();
      if (data.emailSent) showToast('✓ Certificate emailed to ' + email, 'success');
    } catch(e) {}
    showSingleCert({name, surname, id, company, role, trade, code, completedStr}, ev);
  }

  goToStep(certStepIndex());
  btn.disabled = false;
  btn.textContent = t('btn_generate');
}
```

- [ ] **Step 2: Verify single induction still works**

1. Go to `http://localhost:8888/induction`, select Individual, complete all steps
2. On the cert step, your certificate should generate and display normally
3. Try the same name + ID a second time — should show "Already Completed" modal with the existing code

- [ ] **Step 3: Commit**

```bash
cd ~/impi-portal
git add public/induction.html
git commit -m "feat: rewrite generateCert() with duplicate checks, inductor cert, progress, retry"
```

---

## Task 7: Rewrite `showGroupCerts()` with inductor badge, logos, and print styles

**Files:**
- Modify: `public/induction.html`

- [ ] **Step 1: Add print CSS**

Find in the `<style>` section (around line 154):
```css
/* MULTI CERT */
.multi-cert-wrap{display:none;flex-direction:column;gap:20px;}
```

Replace with:
```css
/* MULTI CERT */
.multi-cert-wrap{display:none;flex-direction:column;gap:20px;}
@media print{
  .nav,.banner,.prog-wrap,.cert-actions,.toast,.step-wrap>div:not(#stepCert){display:none!important;}
  #stepCert{display:block!important;}
  .cert-done,.cert-done-icon,.cert-done-title,.cert-done-sub{display:none;}
  #certSingle{display:none!important;}
  .multi-cert-wrap{display:flex!important;}
  .cert{page-break-after:always;box-shadow:none;border:1px solid #ddd;max-width:100%;}
}
```

- [ ] **Step 2: Replace `showGroupCerts()`**

Find the entire `showGroupCerts(members, ev, completedStr)` function (starts at `function showGroupCerts`, ends before `function shareCert`).

Replace with:
```javascript
function showGroupCerts(results, ev, completedStr) {
  document.getElementById('certSingle').style.display = 'none';
  const wrap = document.getElementById('certMulti');
  wrap.style.display = 'flex';

  const impiLogoSrc = currentEvent?.impi_logo || document.getElementById('certLogo')?.src || '';
  const clientLogoSrc = ev.client_logo_url || '';
  const orgLogoSrc = ev.organiser_logo_url || '';

  function logosHtml() {
    return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      ${impiLogoSrc ? `<img src="${impiLogoSrc}" style="height:32px;width:auto;object-fit:contain;background:rgba(255,255,255,0.15);padding:3px 7px;border-radius:5px" alt="IMPI"/>` : ''}
      ${clientLogoSrc ? `<img src="${clientLogoSrc}" style="height:32px;width:auto;object-fit:contain;background:rgba(255,255,255,0.9);padding:3px 7px;border-radius:5px" alt="Event"/>` : ''}
      ${orgLogoSrc ? `<img src="${orgLogoSrc}" style="height:32px;width:auto;object-fit:contain;background:rgba(255,255,255,0.9);padding:3px 7px;border-radius:5px" alt="Organiser"/>` : ''}
    </div>`;
  }

  wrap.innerHTML = results.map((m, i) => {
    if (m.fraudBlocked) {
      return `<div style="background:#fef2f2;border:1.5px solid rgba(212,43,43,0.3);border-radius:8px;padding:16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:20px">⛔</span>
        <div>
          <div style="font-family:var(--fh);font-size:11px;font-weight:800;color:var(--red);margin-bottom:2px">${m.isInductor ? '👑 Team Leader — ' : ''}Duplicate — different ID number</div>
          <div style="font-size:13px;color:#374151">${m.name} ${m.surname} — a record already exists with this name but a different ID number. Certificate not generated.</div>
        </div>
      </div>`;
    }

    const alreadyBadge = m.alreadyCompleted
      ? `<div style="background:#dbeafe;color:#1d4ed8;display:inline-flex;align-items:center;gap:4px;font-family:var(--fh);font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:20px;margin-bottom:8px">✓ Already Completed — Existing Code Below</div>`
      : '';

    const leaderBadge = m.isInductor
      ? `<div style="background:rgba(255,255,255,0.25);display:inline-flex;align-items:center;gap:5px;font-family:var(--fh);font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#fff;padding:4px 10px;border-radius:20px;margin-bottom:6px">👑 Team Leader</div>`
      : '';

    return `
      <div class="cert" id="cert_${i}">
        <div class="cert-stripe" style="flex-direction:column;align-items:flex-start;gap:8px">
          ${logosHtml()}
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
            ${leaderBadge}
            <div class="cert-stripe-title">${t('cert_official')}</div>
            <div class="cert-stripe-sub">${t('cert_safety_cert')}</div>
          </div>
        </div>
        <div class="cert-body">
          ${alreadyBadge}
          <div class="cert-label">${t('cert_certifies')}</div>
          <div class="cert-name">${(m.name + ' ' + m.surname).toUpperCase()}</div>
          <div class="cert-id">${m.id_type || 'ID'}: ${m.id}</div>
          <div style="font-size:12px;color:#9ca3af;margin-bottom:6px">${t('cert_completed_for')}</div>
          <div class="cert-event">${ev.name}</div>
          <div class="cert-venue">${ev.venue || '—'}</div>
          <div class="cert-grid">
            <div class="cert-field"><label>${t('lbl_role')}</label><span>${m.role || '—'}</span></div>
            <div class="cert-field"><label>${t('lbl_trade')}</label><span>${m.trade || '—'}</span></div>
            <div class="cert-field"><label>${t('lbl_company')}</label><span>${m.company || '—'}</span></div>
            <div class="cert-field"><label>${t('cert_completed')}</label><span>${completedStr}</span></div>
          </div>
          <div class="cert-footer">
            <div>
              <div class="cert-verified">${t('cert_verified')}</div>
              <div class="cert-code-label">${t('cert_code_label')}</div>
              <div class="cert-code">${m.code || '—'}</div>
            </div>
            <div id="qr_${i}"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  results.forEach((m, i) => {
    if (m.code && document.getElementById('qr_' + i)) {
      new QRCode(document.getElementById('qr_' + i), {
        text: 'IMPIVERT:' + m.code + ':' + m.name + ':' + ev.id,
        width: 80, height: 80, colorDark: '#000', colorLight: '#fff'
      });
    }
  });

  document.getElementById('multiCertActions').style.display = 'block';
}
```

- [ ] **Step 3: Add Print All button HTML in the cert step**

Find in `induction.html` (around line 521):
```html
  <!-- Multi certificate (group) -->
  <div class="multi-cert-wrap" id="certMulti"></div>
```

Replace with:
```html
  <!-- Multi certificate (group) -->
  <div class="multi-cert-wrap" id="certMulti"></div>
  <div id="multiCertActions" style="display:none;text-align:center;margin-top:16px">
    <button class="btn btn-red" onclick="window.print()">🖨 Print All Certificates</button>
  </div>
```

Note: `showGroupCerts()` already calls `document.getElementById('multiCertActions').style.display = 'block'` at its end (included in Step 2).

- [ ] **Step 4: Verify group induction end-to-end**

1. Go to `http://localhost:8888/induction`, select Group / Team, pick 3 members
2. Fill in Step 1 (inductor info), complete the quiz and legal steps
3. Click Generate Certificate — progress text should update for each cert
4. Result page should show 4 certs (inductor first with 👑 Team Leader badge, then 3 members)
5. Each cert should show logos (if configured), name, ID type + number, trade, code, QR
6. "Print All Certificates" button should appear at the bottom
7. Ctrl+P (or Cmd+P) — each cert should be on its own page

- [ ] **Step 5: Commit**

```bash
cd ~/impi-portal
git add public/induction.html
git commit -m "feat: rewrite showGroupCerts() with inductor badge, logos, print styles"
```

---

## Task 8: Enhanced admin completions search in `admin.html`

**Files:**
- Modify: `public/admin.html`

- [ ] **Step 1: Add `filteredCompletions` to state**

Find (line 463):
```javascript
let allEvents = [], allCompletions = [];
```

Replace with:
```javascript
let allEvents = [], allCompletions = [], filteredCompletions = [];
```

- [ ] **Step 2: Update the completions tab header HTML**

Find (lines 295–313):
```html
    <div class="tab-page" id="tab-completions">
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div><div class="page-title">Completions</div><div class="page-sub">All safety induction completions</div></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="filterEvent" onchange="loadCompletions()" style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--fb);font-size:13px;background:var(--white);color:var(--text);outline:none">
            <option value="">All Events</option>
          </select>
          <button class="btn btn-ghost" onclick="exportCSV()">📥 Export CSV</button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th></th><th>Name</th><th>Company</th><th>Role</th><th>ID Number</th><th>Email</th><th>Event</th><th>Completed</th><th>Email</th><th>Cert Code</th><th>Action</th></tr></thead>
            <tbody id="compBody"><tr><td colspan="11" style="color:var(--muted);padding:20px">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
```

Replace with:
```html
    <div class="tab-page" id="tab-completions">
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div><div class="page-title">Completions</div><div class="page-sub">All safety induction completions</div></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="filterEvent" onchange="loadCompletions()" style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--fb);font-size:13px;background:var(--white);color:var(--text);outline:none">
            <option value="">All Events</option>
          </select>
          <input id="compSearch" type="text" placeholder="🔍 Search company, name, email, ID, role..." oninput="filterCompletions()" style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--fb);font-size:13px;background:var(--white);color:var(--text);outline:none;min-width:260px"/>
          <button class="btn btn-ghost" onclick="exportCSV()">📥 Export CSV</button>
        </div>
      </div>
      <div id="compCount" style="font-size:13px;color:var(--muted);margin-bottom:12px"></div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th></th><th>Name</th><th>Company</th><th>Role</th><th>ID Number</th><th>Email</th><th>Event</th><th>Completed</th><th>Email</th><th>Cert Code</th><th>Action</th></tr></thead>
            <tbody id="compBody"><tr><td colspan="11" style="color:var(--muted);padding:20px">Loading...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Add `filterCompletions()` function**

Find the `async function loadCompletions()` function. Add this new function immediately before it:

```javascript
function filterCompletions(){
  const q=document.getElementById('compSearch')?.value.trim().toLowerCase()||'';
  const eventName=document.getElementById('filterEvent')?.selectedOptions[0]?.text||'All Events';
  filteredCompletions=q
    ?allCompletions.filter(c=>[c.full_name,c.surname,c.company,c.email,c.id_number,c.role,c.trade,c.cert_code,c.phone].some(v=>(v||'').toLowerCase().includes(q)))
    :[...allCompletions];
  const countEl=document.getElementById('compCount');
  if(countEl){
    if(!allCompletions.length){ countEl.textContent=''; }
    else if(q&&filteredCompletions.length===0){ countEl.textContent=`No completions match '${q}' for ${eventName}`; }
    else if(q){ countEl.textContent=`Showing ${filteredCompletions.length} of ${allCompletions.length} completions`; }
    else{ countEl.textContent=`${allCompletions.length} completion${allCompletions.length!==1?'s':''}`; }
  }
  renderCompletions();
}
```

- [ ] **Step 4: Update `loadCompletions()` to call `filterCompletions()` instead of `renderCompletions()`**

Find inside `loadCompletions()`:
```javascript
    allCompletions=await res.json(); allCompletions=Array.isArray(allCompletions)?allCompletions:[];
    renderCompletions();
```

Replace with:
```javascript
    allCompletions=await res.json(); allCompletions=Array.isArray(allCompletions)?allCompletions:[];
    filterCompletions();
```

- [ ] **Step 5: Update `renderCompletions()` to use `filteredCompletions`**

Find in `renderCompletions()`:
```javascript
  if(!allCompletions.length){ tbody.innerHTML='<tr><td colspan="11" style="color:var(--muted);padding:20px;text-align:center">No completions found.</td></tr>'; return; }
  tbody.innerHTML=allCompletions.map((c,i)=>`<tr>
```

Replace with:
```javascript
  if(!filteredCompletions.length){ tbody.innerHTML='<tr><td colspan="11" style="color:var(--muted);padding:20px;text-align:center">No completions found.</td></tr>'; return; }
  tbody.innerHTML=filteredCompletions.map((c,i)=>`<tr>
```

- [ ] **Step 6: Update `exportCSV()` to use `filteredCompletions`**

Find in `exportCSV()`:
```javascript
  if(!allCompletions.length){ showToast('No completions to export','error'); return; }
  const cols=['cert_code','full_name','surname','company','role','trade','id_number','email','phone','event_id','completed_at','email_sent'];
  const csv=[cols.join(','),...allCompletions.map(c=>cols.map(k=>`"${(c[k]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
```

Replace with:
```javascript
  if(!filteredCompletions.length){ showToast('No completions to export','error'); return; }
  const cols=['cert_code','full_name','surname','company','role','trade','id_number','email','phone','event_id','completed_at','email_sent'];
  const csv=[cols.join(','),...filteredCompletions.map(c=>cols.map(k=>`"${(c[k]||'').toString().replace(/"/g,'""')}"`).join(','))].join('\n');
```

- [ ] **Step 7: Verify admin completions search**

1. Log in to admin at `http://localhost:8888/admin`
2. Go to Completions tab
3. Pick an event from the dropdown — only that event's completions should show
4. Type a name or company in the search box — table should filter in real-time
5. Count label above table should update ("Showing 3 of 12 completions")
6. Click Export CSV — downloaded file should only contain visible rows
7. Clear search — all event completions should reappear
8. Change event to "All Events" — all completions reload, search still works

- [ ] **Step 8: Commit**

```bash
cd ~/impi-portal
git add public/admin.html
git commit -m "feat: add real-time search and count display to admin completions tab"
```

---

## Task 9: Run database migration

This is a manual step — run in the Supabase SQL editor.

- [ ] **Step 1: Open Supabase dashboard**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Run the migration**

```sql
CREATE INDEX IF NOT EXISTS idx_completions_dup_check
  ON completions (LOWER(full_name), LOWER(surname), event_id);
```

Click Run. Expected: "Success. No rows returned."

This index makes the duplicate check query fast even with thousands of completions.

---

## Task 10: Full end-to-end test checklist

Run these in order at `http://localhost:8888`:

- [ ] **a) Single induction works as before**
  - Complete an individual induction → certificate generates → email sent ✓

- [ ] **b) Same name + same ID shows existing cert code**
  - Submit same person again → "Already Completed" modal shows their existing cert code ✓

- [ ] **c) Same name + different ID is blocked**
  - Submit same name with different ID → "Duplicate Registration" modal appears ✓

- [ ] **d) Group of 5 generates 6 certificates**
  - Select Group, pick 5 members, fill all fields
  - Click Generate → progress "Generating certificate X of 6..." shows
  - Result: inductor cert first with 👑 badge, then 5 member certs ✓
  - Inductor receives ONE email with subject containing "+5 team certificates" ✓
  - Members do NOT receive separate emails ✓

- [ ] **e) Group of 35 works without breaking**
  - Select 35 members, fill minimal valid data in each row
  - All 36 certs generate without timeout or error ✓

- [ ] **f) Group duplicate handling**
  - Include a member who already completed (same name + same ID) → shown with "Already completed" badge and existing code ✓
  - Include a member with same name but different ID → shown with "Duplicate — different ID" error row ✓
  - Other members in the same group proceed normally ✓

- [ ] **g) Admin event filter**
  - Pick "Toyota Matsuri" → only Toyota completions show ✓
  - Pick "All Events" → all completions show ✓

- [ ] **h) Admin search**
  - Type "Stage Engineering" → only Stage Engineering rows show ✓
  - Count label updates: "Showing 4 of 45 completions" ✓
  - Change event with search active → search re-applies to new event data ✓

- [ ] **i) CSV export respects filters**
  - With event + search active, export CSV → file only contains visible rows ✓

- [ ] **j) Print view**
  - After group cert generation, Cmd+P → each cert on its own page ✓

---

## Deploy (only after all tests pass)

```bash
cd ~/impi-portal
netlify deploy --prod --dir=public
```
