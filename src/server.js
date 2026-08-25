require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes.auth');
const contractsRoutes = require('./routes.contracts');
const clientsRoutes = require('./routes.clients');
const usersRoutes = require('./routes.users');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/users', usersRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KzBlesk CRM запущен на порту ${PORT}`));
