import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 30,
  maxIdle: 15,
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 5000,
  connectTimeout: 30000,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.getConnection().then(conn => {
  console.log('Conectado a Azure MySQL con éxito');
  conn.release();
}).catch(err => {
  console.error('Error al conectar con la base de datos MySQL:', err);
});

// Ping preventivo para evitar caídas por timeout de Azure MySQL
const keepAliveInterval = setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err: any) {
    console.warn('Keepalive Azure MySQL reconnect/ping:', err.message);
  }
}, 30000);
if (keepAliveInterval.unref) {
  keepAliveInterval.unref();
}

export default pool;
