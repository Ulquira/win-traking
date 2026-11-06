import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from './db.ts';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const REPLICATION_SECRET = process.env.REPLICATION_SECRET || 'mi_llave_secreta_de_replicacion_super_segura';

// Middleware de seguridad para validar la firma de la réplica
const verifyReplicationSignature = (req: Request, res: Response, next: () => void) => {
  const signature = req.headers['x-replication-signature'] as string;
  const authHeader = req.headers['authorization'];

  if (!signature || !authHeader) {
    return res.status(401).json({ success: false, message: 'No autorizado: Faltan credenciales de replicación' });
  }

  // Verificar Bearer Token como primera capa
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== REPLICATION_SECRET) {
    return res.status(401).json({ success: false, message: 'No autorizado: Token de replicación incorrecto' });
  }

  // Verificar HMAC SHA256 de integridad de datos
  const computedSignature = crypto
    .createHmac('sha256', REPLICATION_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== computedSignature) {
    return res.status(401).json({ success: false, message: 'No autorizado: Firma de payload inválida' });
  }

  next();
};

// Endpoint que recibe el payload de replicación y lo escribe en la BD destino
router.post('/api/replication/receive', verifyReplicationSignature, async (req: Request, res: Response) => {
  const { table, action, data } = req.body;

  if (!table || !action || !data || typeof data !== 'object') {
    return res.status(400).json({ success: false, message: 'Formato de payload de replicación inválido' });
  }

  // Sanitizar el nombre de la tabla (solo letras, números y guión bajo para evitar SQL injection estructural)
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');

  try {
    if (action === 'INSERT') {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');

      const query = `INSERT INTO ${safeTable} (${keys.join(', ')}) VALUES (${placeholders})`;
      await pool.query(query, values);
      
      console.log(`✅ [Receptor] INSERT completado en tabla ${safeTable}`);
      return res.json({ success: true, message: `INSERT exitoso en ${safeTable}` });
    } 
    
    if (action === 'UPDATE') {
      // Intentamos identificar la llave primaria para el WHERE clause
      const primaryKeys = ['id', 'token', 'idoperacion', 'IDticket', 'OrdenId'];
      const pkName = primaryKeys.find(key => key in data);

      if (!pkName) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se encontró un campo de identificación (id, token, idoperacion) para realizar el UPDATE' 
        });
      }

      const pkValue = data[pkName];

      // Filtramos las columnas a actualizar (no actualizamos la propia llave primaria)
      const updateKeys = Object.keys(data).filter(key => key !== pkName);
      const updateValues = updateKeys.map(key => data[key]);

      if (updateKeys.length === 0) {
        return res.json({ success: true, message: 'Nada que actualizar' });
      }

      const setClause = updateKeys.map(key => `${key} = ?`).join(', ');
      const query = `UPDATE ${safeTable} SET ${setClause} WHERE ${pkName} = ?`;
      
      await pool.query(query, [...updateValues, pkValue]);

      console.log(`✅ [Receptor] UPDATE completado en tabla ${safeTable} para ${pkName} = ${pkValue}`);
      return res.json({ success: true, message: `UPDATE exitoso en ${safeTable}` });
    }

    if (action === 'DELETE') {
      const primaryKeys = ['id', 'token', 'idoperacion', 'IDticket', 'OrdenId'];
      const pkName = primaryKeys.find(key => key in data);

      if (!pkName) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se encontró un campo de identificación para realizar el DELETE' 
        });
      }

      const pkValue = data[pkName];
      const query = `DELETE FROM ${safeTable} WHERE ${pkName} = ?`;
      await pool.query(query, [pkValue]);

      console.log(`✅ [Receptor] DELETE completado en tabla ${safeTable} para ${pkName} = ${pkValue}`);
      return res.json({ success: true, message: `DELETE exitoso en ${safeTable}` });
    }

    return res.status(400).json({ success: false, message: `Acción '${action}' no soportada` });

  } catch (error: any) {
    console.error(`❌ [Receptor] Error aplicando replicación en ${safeTable}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error aplicando la transacción en la BD destino', 
      error: error.message 
    });
  }
});

export default router;
