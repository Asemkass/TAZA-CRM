const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload; // { id, role, full_name }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, SECRET };
