import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const REPLICATION_TARGET_URL = process.env.REPLICATION_TARGET_URL; // URL del servidor de la BD destino
const REPLICATION_SECRET = process.env.REPLICATION_SECRET || 'mi_llave_secreta_de_replicacion_super_segura';

interface ReplicationPayload {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, any>;
}

/**
 * Envía una operación de replicación a la base de datos de destino de forma asíncrona.
 * No bloquea la ejecución principal del servidor si el destino está lento o fuera de línea.
 */
export async function replicateChange(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', data: Record<string, any>) {
  if (!REPLICATION_TARGET_URL) {
    // Si no está configurado, ignoramos silenciosamente o mostramos un warning en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Replicación no configurada: Define REPLICATION_TARGET_URL en tu .env');
    }
    return;
  }

  const payload: ReplicationPayload = {
    table,
    action,
    data
  };

  // Ejecutamos en segundo plano para no demorar la respuesta al usuario final
  setImmediate(async () => {
    try {
      const bodyString = JSON.stringify(payload);
      
      // Generar firma HMAC SHA256 para asegurar que la petición viene de un emisor de confianza
      // y que el payload no ha sido modificado en el camino.
      const signature = crypto
        .createHmac('sha256', REPLICATION_SECRET)
        .update(bodyString)
        .digest('hex');

      console.log(`📡 [Replicación] Enviando ${action} en tabla ${table} al servidor destino...`);

      const response = await fetch(REPLICATION_TARGET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Replication-Signature': signature,
          'Authorization': `Bearer ${REPLICATION_SECRET}`
        },
        body: bodyString
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ [Replicación] Error al replicar en destino (Status ${response.status}):`, errText);
      } else {
        const resData = await response.json();
        console.log(`✅ [Replicación] Replicado con éxito en destino:`, resData);
      }
    } catch (error) {
      console.error(`❌ [Replicación] Falló la conexión con el servidor de réplica:`, error);
    }
  });
}
