USE BD_Phoenix;

-- 1. Agregar columnas para control de atención en vivo
ALTER TABLE logs_chat
  ADD COLUMN asesor_nombre VARCHAR(100) NULL AFTER estado_chat,
  ADD COLUMN ultimo_mensaje_por VARCHAR(20) NOT NULL DEFAULT 'cliente' AFTER asesor_nombre;

-- 2. Crear índice compuesto para optimizar la cola de espera y el polling
CREATE INDEX idx_logs_chat_vivo 
  ON logs_chat (estado_chat, fecha_actualizacion DESC);

-- 3. Verificar estructura actualizada
DESCRIBE logs_chat;