const express = require('express');
const pool = require('./db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();
router.use(requireAuth);

const STATUSES = ['new_call', 'pickup', 'wash', 'delivery', 'closed'];

// GET /api/contracts
// admin -> все договоры (с фильтром по городу/статусу/поиску)
// courier -> только назначенные на него, и только статусы pickup/delivery
router.get('/', async (req, res) => {
  const { city, status, q } = req.query;
  const params = [];
  let where = [];

  if (req.user.role === 'courier') {
    params.push(req.user.id);
    where.push(`c.assigned_courier_id = $${params.length}`);
    where.push(`c.status in ('pickup','delivery')`);
  }
  if (city) {
    params.push(city);
    where.push(`c.city = $${params.length}`);
  }
  if (status && STATUSES.includes(status)) {
    params.push(status);
    where.push(`c.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(lower(cl.phone) like $${params.length} or lower(c.address) like $${params.length} or lower(cl.name) like $${params.length})`);
  }

  const whereSql = where.length ? 'where ' + where.join(' and ') : '';

  const { rows } = await pool.query(
    `select c.*, cl.phone as client_phone, cl.name as client_name,
            u.full_name as courier_name
     from contracts c
     left join clients cl on cl.id = c.client_id
     left join users u on u.id = c.assigned_courier_id
     ${whereSql}
     order by c.created_at desc`,
    params
  );
  res.json(rows);
});

// POST /api/contracts  (admin only — создание нового договора)
router.post('/', requireRole('admin'), async (req, res) => {
  const {
    phone, client_name, city, address, apartment, entrance, floor,
    qty_carpets, area, price_per_m2, cost, status, assigned_courier_id,
    contract_date, comment, payment_method
  } = req.body;
  if (!phone || !address || !qty_carpets || !cost) {
    return res.status(400).json({ error: 'Заполните обязательные поля: телефон, адрес, кол-во ковров, стоимость' });
  }

  // найти или создать клиента
  let client = (await pool.query('select id from clients where phone = $1', [phone])).rows[0];
  if (!client) {
    client = (await pool.query(
      'insert into clients (phone, name) values ($1, $2) returning id',
      [phone, client_name || null]
    )).rows[0];
  } else if (client_name) {
    await pool.query('update clients set name = $1 where id = $2', [client_name, client.id]);
  }

  const { rows } = await pool.query(
    `insert into contracts
      (client_id, city, address, apartment, entrance, floor, qty_carpets, area,
       price_per_m2, cost, status, assigned_courier_id, contract_date, comment, payment_method, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     returning *`,
    [client.id, city, address, apartment, entrance, floor, qty_carpets, area,
     price_per_m2, cost, status || 'new_call', assigned_courier_id || null,
     contract_date || new Date(), comment || null, payment_method || null, req.user.id]
  );

  res.status(201).json(rows[0]);
});

// PATCH /api/contracts/:id  (admin — любое поле; courier — только свой статус)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const existing = (await pool.query('select * from contracts where id = $1', [id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'Договор не найден' });

  if (req.user.role === 'courier') {
    if (existing.assigned_courier_id !== req.user.id) {
      return res.status(403).json({ error: 'Это не ваша заявка' });
    }
    const { status } = req.body;
    if (!status || !['pickup', 'wash', 'delivery', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }
    const { rows } = await pool.query(
      'update contracts set status = $1 where id = $2 returning *',
      [status, id]
    );
    return res.json(rows[0]);
  }

  // admin: обновление любых полей
    const fields = ['city','address','apartment','entrance','floor','qty_carpets','area',
    'price_per_m2','cost','status','assigned_courier_id','contract_date','comment','payment_method'];
  const sets = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      sets.push(`${f} = $${params.length}`);
    }
  });
  if (sets.length === 0) return res.status(400).json({ error: 'Нет данных для обновления' });
  params.push(id);
  const { rows } = await pool.query(
    `update contracts set ${sets.join(', ')} where id = $${params.length} returning *`,
    params
  );
  res.json(rows[0]);
});

// DELETE /api/contracts/:id (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  await pool.query('delete from contracts where id = $1', [req.params.id]);
  res.json({ ok: true });
});

// GET /api/contracts/cash-summary — касса: сумма закрытых договоров (admin only)
router.get('/cash-summary', requireRole('admin'), async (req, res) => {
  const totalRes = await pool.query(
    `select coalesce(sum(cost),0) as total, count(*) as count
     from contracts where status = 'closed'`
  );
  const byDayRes = await pool.query(
    `select contract_date::date as day, coalesce(sum(cost),0) as total, count(*) as count
     from contracts where status = 'closed'
     group by day order by day desc limit 30`
  );
  const byPaymentRes = await pool.query(
    `select coalesce(payment_method,'не указано') as method, coalesce(sum(cost),0) as total, count(*) as count
     from contracts where status = 'closed'
     group by method`
  );
  res.json({
    total: totalRes.rows[0].total,
    count: totalRes.rows[0].count,
    byDay: byDayRes.rows,
    byPayment: byPaymentRes.rows
  });
});

module.exports = router;
