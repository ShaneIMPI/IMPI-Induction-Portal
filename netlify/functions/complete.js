const { db, ok, err, cors, retry } = require('./_shared');
const { Resend } = require('resend');

function makeCertCode(name, idNumber) {
  const p1 = (name || 'XX').replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const p2 = String(idNumber || '000').replace(/\D/g, '').slice(-3).padStart(3, '0');
  const p3 = Date.now().toString(36).slice(-3).toUpperCase();
  const p4 = Math.random().toString(36).slice(2, 4).toUpperCase();
  return (p1 + p2 + p3 + p4).slice(0, 8).toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const supabase = db();

  // Resend email for existing cert
  if (body.action === 'resend') {
    const { cert_code } = body;
    if (!cert_code) return err('cert_code required');
    const { data: comp } = await supabase.from('completions').select('*').eq('cert_code', cert_code).maybeSingle();
    if (!comp) return err('Completion not found', 404);
    sendCertEmail(comp).catch(e => console.error('[resend email]', e.message));
    return ok({ success: true });
  }

  const full_name = body.full_name || body.fullName || '';
  const surname = body.surname || '';
  const id_number = body.id_number || body.idNumber || '';
  const id_type = body.id_type || body.idType || 'SA ID';
  const email = body.email || '';
  const phone = body.phone || '';
  const company = body.company || '';
  const trade = body.trade || '';
  const role = body.role || '';
  const event_id = body.event_id || body.eventId || '';
  const cert_code = body.cert_code || body.certCode || makeCertCode(full_name, id_number);
  const completed_at = body.completed_at || new Date().toISOString();
  const is_group = !!(body.is_group || body.isGroup);
  const group_members = Array.isArray(body.group_members || body.groupMembers) ? (body.group_members || body.groupMembers) : [];

  if (!full_name) return err('full_name required');
  if (!event_id) return err('event_id required');

  // Idempotency: if cert_code already exists, return success
  const { data: existing } = await supabase.from('completions').select('cert_code').eq('cert_code', cert_code).maybeSingle();
  if (existing) return ok({ success: true, cert_code, duplicate: true });

  const record = {
    full_name, surname, id_number, id_type,
    email, phone, company, trade, role,
    event_id, cert_code,
    completed_at,
    email_sent: false
  };

  const saveResult = await retry(() => supabase.from('completions').insert([record]));
  if (saveResult.error) {
    console.error('[complete] save error:', saveResult.error);
    return err('Failed to save completion: ' + saveResult.error.message);
  }

  // Save group members (non-blocking — main cert is already saved)
  if (is_group && group_members.length > 0) {
    const memberRecords = group_members.map(m => ({
      full_name: m.full_name || m.fullName,
      surname: m.surname,
      id_number: m.id_number || m.idNumber,
      id_type: m.id_type || m.idType || 'SA ID',
      email: m.email || email,
      phone: m.phone || phone,
      company,
      trade: m.trade || trade,
      role: m.role || role,
      event_id,
      cert_code: m.cert_code || makeCertCode(m.full_name || m.fullName, m.id_number || m.idNumber),
      completed_at,
      email_sent: false
    }));
    for (const mr of memberRecords) {
      const { data: existingMember } = await supabase.from('completions').select('cert_code').eq('cert_code', mr.cert_code).maybeSingle();
      if (!existingMember) {
        retry(() => supabase.from('completions').insert([mr])).catch(e => console.error('[complete group member]', e.message));
      }
    }
  }

  // Email — non-blocking
  let emailSent = false;
  if (email) {
    try {
      await sendCertEmail(record, group_members);
      await supabase.from('completions').update({ email_sent: true }).eq('cert_code', cert_code);
      emailSent = true;
    } catch (e) {
      console.error('[complete email]', e.message);
    }
  }

  return ok({ success: true, cert_code, email_sent: emailSent });
};

async function sendCertEmail(comp, groupMembers = []) {
  if (!process.env.RESEND_API_KEY || !comp.email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const verifyBase = (process.env.SITE_URL || 'https://impi-inductions.netlify.app');
  const verifyUrl = `${verifyBase}/verify?code=${comp.cert_code}`;
  const from = process.env.RESEND_FROM_EMAIL || 'IMPI Safety Services <noreply@impisafety.co.za>';

  const hasGroup = groupMembers.length > 0;
  const subject = hasGroup
    ? `Your IMPI Safety Induction Certificate (+${groupMembers.length} team certificate${groupMembers.length !== 1 ? 's' : ''})`
    : 'Your IMPI Safety Induction Certificate';

  const groupCodesHtml = hasGroup ? `
    <div style="margin:20px 0;padding:16px;background:#fffbeb;border-left:4px solid #f5c800;border-radius:0 8px 8px 0">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:10px">Team Member Certificates</div>
      ${groupMembers.map(m => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #fde68a">
          <span style="font-size:13px;color:#1f2937">${m.full_name || m.fullName} ${m.surname}</span>
          <span style="font-family:monospace;font-size:14px;font-weight:800;color:#d42b2b;letter-spacing:2px">${m.cert_code}</span>
        </div>
      `).join('')}
    </div>` : '';

  await resend.emails.send({
    from,
    to: comp.email,
    subject,
    html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#d42b2b;padding:24px 32px">
    <div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">IMPI Safety Services International</div>
    <div style="color:#fff;font-size:18px;font-weight:800;margin-top:4px">Safety Induction Certificate</div>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px;margin:0 0 24px">Hi <strong>${comp.full_name} ${comp.surname || ''}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">
      Your safety induction has been successfully completed. Save or print this certificate and present it at the venue entrance.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 24px">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Your Certificate Code</div>
      <div style="font-family:monospace;font-size:28px;font-weight:900;color:#d42b2b;letter-spacing:4px;margin-bottom:16px">${comp.cert_code}</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">Name</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:#111;text-align:right">${comp.full_name} ${comp.surname || ''}</td></tr>
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">ID Type</td><td style="padding:4px 0;font-size:14px;color:#374151;text-align:right">${comp.id_type || 'SA ID'}</td></tr>
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">Company</td><td style="padding:4px 0;font-size:14px;color:#374151;text-align:right">${comp.company || '—'}</td></tr>
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">Completed</td><td style="padding:4px 0;font-size:14px;color:#374151;text-align:right">${new Date(comp.completed_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
      </table>
    </div>
    ${groupCodesHtml}
    <a href="${verifyUrl}" style="display:inline-block;background:#d42b2b;color:#fff;font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin:0 0 24px">✓ Verify Certificate</a>
    <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0">
      This certificate was issued by IMPI Safety Services International.<br>
      Questions? <a href="mailto:info@impisafety.co.za" style="color:#d42b2b">info@impisafety.co.za</a>
    </p>
  </div>
</div>`
  });
}
