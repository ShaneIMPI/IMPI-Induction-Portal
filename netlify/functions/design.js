const { db, verifyToken, ok, err, cors, getPortalSettings, savePortalSettings } = require('./_shared');

const DEFAULTS = {
  primary_color: '#d42b2b',
  accent_color: '#f5c800',
  text_color: '#ffffff',
  button_style: 'rounded',
  logo_size: '120',
  heading_text: 'IMPI Safety Induction Portal',
  subtitle_text: 'Complete your safety induction before accessing the event.',
  impi_logo_url: '',
  hero_image_url: '',
  induction_banner_url: ''
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const supabase = db();

  if (event.httpMethod === 'GET') {
    const settings = await getPortalSettings(supabase);
    return ok({ ...DEFAULTS, ...settings });
  }

  if (event.httpMethod === 'POST') {
    const user = verifyToken(event);
    if (!user) return err('Unauthorized', 401);
    let settings;
    try { settings = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const error = await savePortalSettings(supabase, settings);
    if (error) { console.error('[design POST]', error); return err(error.message); }
    return ok({ success: true });
  }

  return err('Method not allowed', 405);
};
