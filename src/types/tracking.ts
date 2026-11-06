export interface TecnicoData {
    nombre: string;
    dni?: string;
    foto?: string | null;
    cuadrilla: string;
    telefono: string;
}

export interface InstalacionData {
    cliente_nombre?: string;
    cliente_telefono?: string;
    direccion?: string;
    idoperacion?: string | number;
    status: 'programada' | 'asignado' | 'en_camino' | 'en_proceso' | 'finalizada' | 'cerrada' | string;
    tecnico?: TecnicoData;
    eta?: string;
    trafico?: string;
    coordenadas_cliente?: [number, number];
    coordenadas_tecnico?: [number, number];
    fecha_programacion?: string;
    tramo?: string;
    token_inicio?: string;
    pin_token?: string;
    campana?: string;
    codisegui?: string;
    tipo?: 'instalacion' | 'ticket' | 'postventa' | string;
    tipo_servicio?: string;
    tipo_trabajo?: string;
    motivo_postventa?: string;
    producto?: string;
    reprogramada?: boolean;
    encuesta_completada?: boolean;
}

export interface VisitaItem {
    idoperacion: string | number;
    token: string;
    pin_token?: string | null;
    tipo: 'ticket' | 'instalacion';
    titulo: string;
    ticketLabel: string;
    codisegui?: string | null;
    producto: string;
    campana?: string | null;
    direccion: string;
    estado: string;
    estado_raw?: string;
    fecha?: string;
    tramo?: string;
}

export interface NotificationItem {
    title: string;
    body: string;
    time: Date;
    read: boolean;
}

export interface EncuestaAppState {
    satisfaccion_atencion: number;
    facilidad_uso: number;
    satisfaccion_experiencia: number;
    seguridad_datos_tecnico: string;
    comentarios: string;
}