// Использование: node src/seed-admin.js email пароль "Имя Фамилия"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function main() {
  const [,, email, password, fullName] = process.argv;
  if (!email || !password || !fullName) {
    console.log('Использование: node src/seed-admin.js email пароль "Имя Фамилия"');
    process.exit(1);
  }
  const password_hash = await bcrypt.hash(password, 10);
  await pool.query(
    `insert into users (email, password_hash, role, full_name)
     values ($1, $2, 'admin', $3)
     on conflict (email) do update set password_hash = excluded.password_hash`,
    [email.toLowerCase().trim(), password_hash, fullName]
  );
  console.log(`Админ создан: ${email}`);
  process.exit(0);
}

main();
