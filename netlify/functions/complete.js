const { db, ok, err, cors } = require('./_shared');
const { Resend } = require('resend');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const supabase = db();
  const body = JSON.parse(event.body || '{}');
  const { action } = body;

  // Resend certificate email
  if (action === 'resend') {
    const { cert_code } = body;
    if (!cert_code) return err('cert_code required');
    const { data: comp } = await supabase.from('completions').select('*').eq('cert_code', cert_code).single();
    if (!comp) return err('Completion not found', 404);
    await sendCertEmail(comp);
    return ok({ success: true });
  }

  // Save completion — accept camelCase (from induction page) or snake_case
  const full_name = body.full_name || body.fullName;
  const surname = body.surname;
  const id_number = body.id_number || body.idNumber;
  const id_type = body.id_type || body.idType || 'RSA ID';
  const email = body.email;
  const phone = body.phone;
  const company = body.company;
  const trade = body.trade;
  const role = body.role;
  const event_id = body.event_id || body.eventId;
  const cert_code = body.cert_code || body.certCode;
  const completed_at = body.completed_at;
  const is_group = body.is_group || body.isGroup || false;
  const group_count = parseInt(body.group_count || body.groupCount) || 0;
  const group_members = body.group_members || body.groupMembers;

  if (!cert_code || !full_name) return err('Missing required fields');

  // Check for duplicate cert code
  const { data: existing } = await supabase.from('completions').select('cert_code').eq('cert_code', cert_code).single();
  if (existing) return ok({ success: true, cert_code, duplicate: true });

  const record = {
    full_name, surname, id_number, id_type: id_type || 'RSA ID',
    email, phone, company, trade, role,
    event_id, cert_code,
    completed_at: completed_at || new Date().toISOString(),
    email_sent: false,
    is_group: is_group || false
  };

  const { error } = await supabase.from('completions').insert([record]);
  if (error) return err(error.message);

  // Save group members if provided
  if (is_group && Array.isArray(group_members) && group_members.length > 0) {
    const memberRecords = group_members.map(m => ({
      full_name: m.full_name, surname: m.surname,
      id_number: m.id_number, id_type: m.id_type || 'RSA ID',
      email: m.email || email, phone: m.phone || phone,
      company, trade: m.trade || trade, role: m.role || role,
      event_id, cert_code: m.cert_code,
      completed_at: record.completed_at,
      email_sent: false, is_group: true
    }));
    await supabase.from('completions').insert(memberRecords);
  }

  // Send certificate email
  let emailSent = false;
  if (email) {
    try {
      await sendCertEmail({ ...record }, group_count);
      await supabase.from('completions').update({ email_sent: true }).eq('cert_code', cert_code);
      emailSent = true;
    } catch (e) {
      console.error('Email send error:', e.message);
    }
  }

  return ok({ success: true, cert_code, email_sent: emailSent });
};

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
