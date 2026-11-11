CREATE TABLE IF NOT EXISTS logs_chat (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(150) NOT NULL,
  orden_id VARCHAR(50) DEFAULT NULL,
  codisegui VARCHAR(50) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  grupo_servicio VARCHAR(50) DEFAULT NULL,
  motivo VARCHAR(120) DEFAULT NULL,
  estado_chat VARCHAR(50) DEFAULT 'iniciado',
  asesor_nombre VARCHAR(100) DEFAULT NULL,
  ultimo_mensaje_por VARCHAR(20) NOT NULL DEFAULT 'cliente',
  mensajes_json JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_orden_id (orden_id),
  INDEX idx_logs_chat_vivo (estado_chat, updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;