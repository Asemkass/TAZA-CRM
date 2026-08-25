const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { SECRET } = require('./auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const { rows } = await pool.query(
    'select id, email, password_hash, role, full_name, is_active from users where email = $1',
    [email.toLowerCase().trim()]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, full_name: user.full_name },
    SECRET,
    { expiresIn: '12h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  });

  res.json({ id: user.id, role: user.role, full_name: user.full_name });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const payload = jwt.verify(token, SECRET);
    res.json(payload);
  } catch {
    res.status(401).json({ error: 'Сессия истекла' });
  }
});

module.exports = router;
