const { db, verifyToken, ok, err, cors, hashStr, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);
  const supabase = db();

  if (event.httpMethod === 'GET') {
    const action = event.queryStringParameters?.action;
    if (action === 'listUsers') {
      const result = await retry(() =>
        supabase.from('admin_users').select('id,name,email,role').order('created_at')
      );
      return ok({ users: result.data || [] });
    }
    return err('Unknown action');
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { action } = body;

    if (action === 'changePassword') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) return err('Password must be at least 6 characters');
      const hashed = hashStr(newPassword);
      await supabase.from('admin_users').update({ password: hashed }).eq('email', 'admin@impi');
      return ok({ success: true });
    }

    if (action === 'addUser') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { name, email, password, role } = body;
      if (!name || !email || !password) return err('name, email, password required');
      const hashed = hashStr(password);
      const result = await retry(() =>
        supabase.from('admin_users').insert([{ name, email: email.toLowerCase(), password: hashed, password_hash: hashed, role: role || 'staff' }])
      );
      if (result.error) return err(result.error.message);
      return ok({ success: true });
    }

    if (action === 'updateUserRole') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { userId, role } = body;
      if (!userId || !role) return err('userId and role required');
      const result = await retry(() =>
        supabase.from('admin_users').update({ role }).eq('id', userId)
      );
      if (result.error) return err(result.error.message);
      return ok({ success: true });
    }

    if (action === 'resetUserPw') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { userId, newPassword } = body;
      if (!userId || !newPassword) return err('userId and newPassword required');
      const hashed = hashStr(newPassword);
      await supabase.from('admin_users').update({ password: hashed, password_hash: hashed }).eq('id', userId);
      return ok({ success: true });
    }

    if (action === 'removeUser') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { userId } = body;
      if (!userId) return err('userId required');
      const result = await retry(() => supabase.from('admin_users').delete().eq('id', userId));
      if (result.error) return err(result.error.message);
      return ok({ success: true });
    }

    return err('Unknown action');
  }

  return err('Method not allowed', 405);
};
