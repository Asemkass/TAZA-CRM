const express = require('express');
const pool = require('./db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/clients — карта клиента: список клиентов с агрегатами
router.get('/', async (req, res) => {
  const { q } = req.query;
  const params = [];
  let where = '';
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where = `where lower(cl.phone) like $1 or lower(cl.name) like $1`;
  }
  const { rows } = await pool.query(
    `select cl.id, cl.phone, cl.name, cl.first_contact,
            count(c.id) as contracts_count,
            max(c.created_at) as last_update,
            coalesce(sum(c.cost) filter (where c.status = 'closed'), 0) as total_spent
     from clients cl
     left join contracts c on c.client_id = cl.id
     ${where}
     group by cl.id
     order by last_update desc nulls last`,
    params
  );
  res.json(rows);
});

// GET /api/clients/:id — карточка одного клиента + все его договоры
router.get('/:id', async (req, res) => {
  const client = (await pool.query('select * from clients where id = $1', [req.params.id])).rows[0];
  if (!client) return res.status(404).json({ error: 'Клиент не найден' });

  const contracts = (await pool.query(
    `select c.*, u.full_name as courier_name from contracts c
     left join users u on u.id = c.assigned_courier_id
     where c.client_id = $1 order by c.created_at desc`,
    [req.params.id]
  )).rows;

  res.json({ ...client, contracts });
});

// DELETE /api/clients/:id — удалить клиента (admin only)
router.delete('/:id', async (req, res) => {
  await pool.query('delete from clients where id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
