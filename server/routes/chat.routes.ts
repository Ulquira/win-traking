import { Router, Request, Response } from 'express';
import pool from '../db.ts';

const router = Router();

// 1. Iniciar/Actualizar sesión del bot o escalar a "esperando_asesor"
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      id,
      token,
      orden_id,
      codisegui,
      phone,
      grupo_servicio,
      motivo,
      estado_chat,
      mensajes,
      mensajes_json,
      ultimo_mensaje_por
    } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token requerido' });
    }

    const listaMensajes = Array.isArray(mensajes_json)
      ? mensajes_json
      : Array.isArray(mensajes)
        ? mensajes
        : [];

    const mensajesStr = JSON.stringify(listaMensajes);
    const autorUltimo = ultimo_mensaje_por || 'cliente';

    if (id) {
      await pool.query(
        `UPDATE logs_chat 
         SET motivo = COALESCE(?, motivo),
             estado_chat = COALESCE(?, estado_chat),
             ultimo_mensaje_por = ?,
             mensajes_json = ?,
             updated_at = NOW()
         WHERE id = ? AND token = ?`,
        [motivo || null, estado_chat || null, autorUltimo, mensajesStr, id, token]
      );
      return res.json({ success: true, id });
    }

    // Si ya tiene un chat abierto con este token que aún no está finalizado, lo reutilizamos
    const [existing]: any = await pool.query(
      `SELECT id FROM logs_chat 
       WHERE token = ? AND estado_chat NOT IN ('Finalizado', 'resuelto') 
       ORDER BY id DESC LIMIT 1`,
      [token]
    );

    if (existing && existing.length > 0) {
      const existingId = existing[0].id;
      await pool.query(
        `UPDATE logs_chat 
         SET motivo = COALESCE(?, motivo),
             estado_chat = COALESCE(?, estado_chat),
             ultimo_mensaje_por = ?,
             mensajes_json = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [motivo || null, estado_chat || null, autorUltimo, mensajesStr, existingId]
      );
      return res.json({ success: true, id: existingId });
    }

    const [result]: any = await pool.query(
      `INSERT INTO logs_chat 
        (token, orden_id, codisegui, phone, grupo_servicio, motivo, estado_chat, ultimo_mensaje_por, mensajes_json) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        token,
        orden_id ? String(orden_id) : null,
        codisegui ? String(codisegui) : null,
        phone ? String(phone) : null,
        grupo_servicio || null,
        motivo || null,
        estado_chat || 'En Curso',
        autorUltimo,
        mensajesStr
      ]
    );
    return res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error en POST /api/chat-log:', error);
    return res.status(500).json({ success: false, message: 'Error interno al guardar chat' });
  }
});

// 2. Bandeja para el Dashboard de Asesores: Listar chats activos
router.get('/activos', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, token, orden_id, codisegui, phone, grupo_servicio, motivo, 
              estado_chat, asesor_nombre, ultimo_mensaje_por, mensajes_json, created_at, updated_at
       FROM logs_chat
       WHERE estado_chat IN ('esperando_asesor', 'en_atencion', 'Derivado a Asesor')
       ORDER BY CASE WHEN estado_chat = 'esperando_asesor' THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 100`
    );

    const data = rows.map((r: any) => ({
      ...r,
      mensajes: typeof r.mensajes_json === 'string' ? JSON.parse(r.mensajes_json) : (r.mensajes_json || [])
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en GET /api/chat-log/activos:', error);
    return res.status(500).json({ success: false, message: 'Error al listar chats activos' });
  }
});

// 3. Polling del Cliente: Obtener estado y mensajes de su sesión
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const chatId = Number(req.params.id);
    const token = String(req.query.token || '');

    if (!chatId || !token) {
      return res.status(400).json({ success: false, message: 'ID y token requeridos' });
    }

    const [rows]: any = await pool.query(
      `SELECT id, estado_chat, asesor_nombre, ultimo_mensaje_por, mensajes_json, updated_at
       FROM logs_chat
       WHERE id = ? AND token = ?
       LIMIT 1`,
      [chatId, token]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    }

    const row = rows[0];
    const mensajes = typeof row.mensajes_json === 'string'
      ? JSON.parse(row.mensajes_json)
      : (row.mensajes_json || []);

    return res.json({
      success: true,
      data: {
        id: row.id,
        estado_chat: row.estado_chat,
        asesor_nombre: row.asesor_nombre,
        ultimo_mensaje_por: row.ultimo_mensaje_por,
        mensajes,
        updated_at: row.updated_at
      }
    });
  } catch (error) {
    console.error('Error en GET /api/chat-log/:id:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar chat' });
  }
});

// 4. Enviar mensaje en vivo (Mantiene la estructura original: orden, fecha_utc, emisor, rol, tipo, texto)
router.post('/:id/mensaje', async (req: Request, res: Response) => {
  try {
    const chatId = Number(req.params.id);
    const { sender, text, texto, asesor_nombre, nuevo_estado } = req.body;
    const cleanText = String(text || texto || '').trim();

    if (!chatId || !cleanText) {
      return res.status(400).json({ success: false, message: 'ID y texto requeridos' });
    }

    const [rows]: any = await pool.query(
      `SELECT mensajes_json, estado_chat, asesor_nombre FROM logs_chat WHERE id = ? LIMIT 1`,
      [chatId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chat no encontrado' });
    }

    const currentMessages = typeof rows[0].mensajes_json === 'string'
      ? JSON.parse(rows[0].mensajes_json)
      : (rows[0].mensajes_json || []);

    const isAgent = sender === 'agent' || sender === 'asesor';
    const nombreAutor = isAgent ? (asesor_nombre || rows[0].asesor_nombre || 'Asesor WIN') : 'Cliente';

    const newMsg = {
      orden: currentMessages.length + 1,
      fecha_utc: new Date().toISOString(),
      emisor: isAgent ? 'ASESOR_WIN' : 'CLIENTE',
      rol: isAgent ? 'asesor' : 'cliente',
      autor: nombreAutor,
      tipo: 'text',
      texto: cleanText
    };

    currentMessages.push(newMsg);

    const nextState = nuevo_estado || (isAgent ? 'en_atencion' : rows[0].estado_chat);
    const nextAsesor = isAgent ? nombreAutor : rows[0].asesor_nombre;
    const ultimoPor = isAgent ? 'asesor' : 'cliente';

    await pool.query(
      `UPDATE logs_chat
       SET mensajes_json = ?,
           estado_chat = ?,
           asesor_nombre = ?,
           ultimo_mensaje_por = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(currentMessages), nextState, nextAsesor, ultimoPor, chatId]
    );

    return res.json({
      success: true,
      estado_chat: nextState,
      asesor_nombre: nextAsesor,
      mensajes: currentMessages
    });
  } catch (error) {
    console.error('Error en POST /api/chat-log/:id/mensaje:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar mensaje' });
  }
});

export default router;