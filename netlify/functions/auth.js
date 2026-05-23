const { db, hashStr, generateToken, ok, err, cors } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return err('Invalid JSON'); }

  const { password, email } = body;
  if (!password) return ok({ success: false, message: 'Password required' });

  const masterPw = process.env.ADMIN_PASSWORD;

  // Master admin — no email required
  if (!email) {
    if (password !== masterPw) {
      return ok({ success: false, message: 'Incorrect password. Team members: enter your email address too.' });
    }
    const token = generateToken({ role: 'admin', email: 'admin@impi', name: 'Admin' });
    return ok({ success: true, token, role: 'admin', name: 'Admin' });
  }

  // Team user login
  const supabase = db();
  const { data: user, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) return ok({ success: false, message: 'No account found for this email.' });

  const inputHash = hashStr(password);
  const match = user.password === password
    || user.password_hash === password
    || user.password === inputHash
    || user.password_hash === inputHash;

  if (!match) return ok({ success: false, message: 'Incorrect password.' });

  const token = generateToken({ role: user.role || 'staff', email: user.email, userId: user.id, name: user.name });
  return ok({ success: true, token, role: user.role || 'staff', name: user.name });
};
