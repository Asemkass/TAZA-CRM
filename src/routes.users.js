const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/users — список сотрудников (для назначения курьера на заявку)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'select id, email, role, full_name, phone, is_active, created_at from users order by created_at desc'
  );
  res.json(rows);
});

// POST /api/users — создать нового сотрудника (курьера или ещё одного админа)
router.post('/', async (req, res) => {
  const { email, password, role, full_name, phone } = req.body;
  if (!email || !password || !role || !full_name) {
    return res.status(400).json({ error: 'Заполните email, пароль, роль и имя' });
  }
  if (!['admin', 'courier'].includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  }

  const exists = (await pool.query('select id from users where email = $1', [email.toLowerCase()])).rows[0];
  if (exists) return res.status(409).json({ error: 'Такой email уже зарегистрирован' });

  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `insert into users (email, password_hash, role, full_name, phone)
     values ($1,$2,$3,$4,$5) returning id, email, role, full_name, phone, is_active, created_at`,
    [email.toLowerCase().trim(), password_hash, role, full_name, phone || null]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/users/:id — активировать/деактивировать сотрудника
router.patch('/:id', async (req, res) => {
  const { is_active } = req.body;
  const { rows } = await pool.query(
    'update users set is_active = $1 where id = $2 returning id, email, role, full_name, is_active',
    [is_active, req.params.id]
  );
  res.json(rows[0]);
});

module.exports = router;
