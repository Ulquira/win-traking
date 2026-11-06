import crypto from 'crypto';

const OPAQUE_TOKEN_SECRET = process.env.OPAQUE_TOKEN_SECRET || 'win-telecom-secret-opaque-key-2026-secure';

/**
 * Genera un token opaco y autenticado con AES-256-GCM
 * Encripta el documento y la fecha actual en un formato seguro y compacto para URL (base64url)
 */
export function createOpaqueToken(documento: string): string {
  const clean = String(documento || '').trim();
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(OPAQUE_TOKEN_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const payload = `${clean}|${Date.now()}`;
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/**
 * Descifra el token opaco y extrae el documento original
 * Si el token es alterado o inválido, retorna null
 */
export function decodeOpaqueToken(token: string): { documento: string; timestamp: number } | null {
  try {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const combined = Buffer.from(raw, 'base64url');
    if (combined.length < 28) return null; // 12 bytes IV + 16 bytes auth tag mínimo

    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    const key = crypto.createHash('sha256').update(OPAQUE_TOKEN_SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const [d, t] = decrypted.split('|');
    if (!d || !t) return null;

    return { documento: d, timestamp: Number(t) };
  } catch {
    return null;
  }
}
