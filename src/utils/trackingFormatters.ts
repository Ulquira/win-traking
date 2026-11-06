import { format } from "date-fns";
import { es } from "date-fns/locale";
import { VisitaItem } from "@/types/tracking";

export interface FormattedDayItem {
    iso: string;
    headerLabel: string;
    dayOfWeek: string;
    dayNum: string;
    monthName: string;
    disponible?: boolean;
}

export const parseSafeDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
        const [year, month, day] = match[1].split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

export const normalizeDateStr = (dateStr?: string) => {
    if (!dateStr) return '';
    const clean = dateStr.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        const [d, m, y] = clean.split('-');
        return `${y}-${m}-${d}`;
    }
    return clean;
};

export const normalizeTramo = (tramoStr?: string) => {
    if (!tramoStr) return '';
    const clean = tramoStr.replace(/\s+/g, '');
    if (clean === '08:00-11:59' || clean === '08:00-12:00') return '08:00 - 12:00';
    if (clean === '12:00-15:59' || clean === '12:00-16:00') return '12:00 - 16:00';
    if (clean === '16:00-20:00' || clean === '16:00-19:59') return '16:00 - 20:00';

    const m = tramoStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (m) {
        const [_, h1, m1, h2, m2] = m;
        let endH = parseInt(h2, 10);
        let endM = parseInt(m2, 10);
        if (endM === 59) {
            endH = (endH + 1) % 24;
            endM = 0;
        }
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(parseInt(h1, 10))}:${m1} - ${pad(endH)}:${pad(endM)}`;
    }
    return tramoStr.trim();
};

export const parseApiDate = (fechaStr: string): FormattedDayItem => {
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    let d = 1, m = 1, y = 2026;
    if (fechaStr.includes('-')) {
        const parts = fechaStr.split('-').map(Number);
        if (parts[0] > 1000) [y, m, d] = parts;
        else[d, m, y] = parts;
    }
    const dateObj = new Date(y, m - 1, d);
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(y, m - 1, d);
    const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    const dayOfWeek = diasSemana[dateObj.getDay()];
    const dayNum = dateObj.getDate().toString().padStart(2, '0');
    const monthName = meses[dateObj.getMonth()];

    return {
        iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        headerLabel: diffDays === 1 ? 'Mañana' : dayOfWeek,
        dayOfWeek,
        dayNum,
        monthName
    };
};

export const getAvailableDaysFallback = (): Required<FormattedDayItem>[] => {
    const days: Required<FormattedDayItem>[] = [];
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
        const isoString = localDate.toISOString().split('T')[0];
        days.push({
            iso: isoString,
            headerLabel: i === 1 ? 'Mañana' : diasSemana[d.getDay()],
            dayOfWeek: diasSemana[d.getDay()],
            dayNum: d.getDate().toString().padStart(2, '0'),
            monthName: meses[d.getMonth()],
            disponible: true
        });
    }
    return days;
};

export const formatSelectedDate = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    let y = 0, mesIdx = 0, dia = 0;
    if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        mesIdx = parseInt(parts[1], 10) - 1;
        dia = parseInt(parts[2], 10);
    } else {
        dia = parseInt(parts[0], 10);
        mesIdx = parseInt(parts[1], 10) - 1;
        y = parseInt(parts[2], 10);
    }
    const mesesLargos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dObj = new Date(y, mesIdx, dia);
    const dayName = format(dObj, 'EEEE', { locale: es });
    const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${capDay}, ${dia} de ${mesesLargos[mesIdx] || ''}`;
};

export const formatTramoToRange = (tramoStr?: string) => {
    if (!tramoStr) return 'De 8:00 am. a 12:00 pm';
    const t = tramoStr.toLowerCase().trim();
    if (t.startsWith('08') || t.startsWith('8')) return 'De 8:00 am. a 12:00 pm';
    if (t.startsWith('12')) return 'De 12:00 pm. a 4:00 pm';
    if (t.startsWith('16') || t.startsWith('4')) return 'De 4:00 pm. a 8:00 pm';
    return tramoStr;
};

export const toTitleCase = (text?: string) => {
    if (!text) return '';
    return text.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

export const cleanCommercialTags = (text?: string): string => {
    if (!text) return '';
    return text
        .replace(/\(?\s*(?:en\s+)?(comodato|alquiler|venta)\s*\)?/gi, '')
        .replace(/\(?\s*(?:al\s+)?(contado|credito|crédito)\s*\)?/gi, '')
        .replace(/\(?\s*(?:en\s+)?(cuotas|financiado)\s*\)?/gi, '')
        .replace(/\(?\s*(promo|promoción|promocion)\s*\)?/gi, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

export const formatSvaName = (text?: string) => {
    if (!text) return '';
    const cleanText = cleanCommercialTags(text);
    if (!cleanText) return '';
    const specialWords: Record<string, string> = {
        'win': 'Win', 'fono': 'Fono', 'dgo': 'Dgo', 'tv': 'TV', 'ont': 'ONT',
        'ap': 'AP', 'ip': 'IP', 'vpn': 'VPN', 'wifi': 'Wifi', 'wi-fi': 'Wi-Fi',
        'mesh': 'Mesh', 'kit': 'Kit', 'pro': 'Pro', 'plus': 'Plus', 'full': 'Full',
        'de': 'de', 'en': 'en', 'instalación': 'Instalación', 'instalacion': 'Instalación',
        'cableada': 'Cableada', 'cableado': 'Cableado', 'utp': 'UTP', 'entrega': 'Entrega'
    };

    return cleanText.trim().split(' ').map((word, idx) => {
        const lower = word.toLowerCase();
        if (specialWords[lower]) {
            const w = specialWords[lower];
            return idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

export const parsePlanData = (campana?: string): { paquete: string; svas: string[]; tienePromoAumento: boolean } => {
    if (!campana || !campana.includes('|')) return { paquete: '', svas: [] as string[], tienePromoAumento: false };
    const parts = campana.split('|');
    let paquete = '';
    let rawSvas: string[] = [];
    let cantidadMesh = 0;
    let instalacionMesh = false;

    parts.forEach(part => {
        const [key, ...valueParts] = part.split(':');
        if (!key || valueParts.length === 0) return;
        const value = valueParts.join(':').trim();
        const cleanKey = key.trim().toLowerCase();

        if (cleanKey === 'paquete') paquete = value;
        else if (cleanKey === "sva's" || cleanKey === "svas") {
            rawSvas = value.split('+').map(s => s.trim())
                .filter(s => s.length > 0 && !/^(ninguno|no|n\/a|na|no aplica|-|0|null|sin\s*sva|sin\s*sva's)$/i.test(s));
        } else if (cleanKey === 'cantidad de mesh') {
            const match = value.match(/\d+/);
            if (match) cantidadMesh = parseInt(match[0], 10);
        } else if (cleanKey === 'instalacion de mesh' || cleanKey === 'instalación de mesh') {
            const match = value.match(/\d+/);
            if (match && parseInt(match[0], 10) > 0) instalacionMesh = true;
            else if (/^(si|sí|true)/i.test(value)) instalacionMesh = true;
        }
    });

    const finalSvas: string[] = [];
    let meshAgregado = false;

    rawSvas.forEach(s => {
        const text = cleanCommercialTags(s);
        const esItemMesh = /mesh/i.test(text);
        const esServicioCableado = /servicio\s+cableado/i.test(text);

        if (esItemMesh) {
            if (esServicioCableado) instalacionMesh = true;
            if (!meshAgregado) {
                meshAgregado = true;
                let meshText = cantidadMesh > 0 ? `${cantidadMesh} Mesh` : 'Mesh';
                if (instalacionMesh) meshText += ' + Instalación Cableada';
                finalSvas.push(meshText);
            }
        } else if (text.length > 0) {
            finalSvas.push(text);
        }
    });

    if (cantidadMesh > 0 && !meshAgregado) {
        let meshText = `${cantidadMesh} Mesh`;
        if (instalacionMesh) meshText += ' + Instalación Cableada';
        finalSvas.push(meshText);
    }

    return { paquete, svas: Array.from(new Set(finalSvas)), tienePromoAumento: false };
};

export const formatPostventaServices = (rawText?: string): string[] => {
    if (!rawText) return ['Atención Postventa'];
    let clean = cleanCommercialTags(rawText);
    if (!clean) return ['Atención Postventa'];
    clean = clean.replace(/\bpendiente\s+de\s+/gi, '').replace(/\bentrega\s+mesh\b/gi, 'Entrega de Mesh');

    const hasMesh = /mesh/i.test(clean);
    const hasCableado = /cablead|instalaci[oó]n\s*cableada/i.test(clean);

    if (hasMesh && hasCableado) {
        const match = clean.match(/(\d+)\s*mesh/i);
        const count = match ? parseInt(match[1], 10) : '';
        const meshLabel = count ? `${count} Mesh + Instalación Cableada` : 'Mesh + Instalación Cableada';
        const others = clean.split('+').map(p => p.trim()).filter(p => p.length > 0 && !/mesh/i.test(p) && !/cablead/i.test(p));
        return [meshLabel, ...others.map(formatSvaName)];
    }
    if (clean.includes('+') || clean.includes('/')) {
        return clean.split(/[+/]/).map(p => p.trim()).filter(p => p.length > 0).map(formatSvaName);
    }
    return [formatSvaName(clean)];
};

export const formatMaskedDni = (dni?: string) => {
    if (!dni) return '';
    const clean = dni.trim();
    if (clean.length <= 4 || clean.startsWith('****')) return clean;
    return '****' + clean.slice(4);
};

export const extractTechnicianName = (nombre?: string, _cuadrilla?: string) => {
    if (nombre && nombre.trim() && nombre !== "Técnico Asignado") {
        return toTitleCase(nombre.trim());
    }
    return "Técnico Asignado";
};

export const formatAddress = (address?: string) => {
    if (!address) return 'Cargando...';
    let clean = address.split(/\|\|\s*referencia|\|\s*referencia|\breferencia\s*:/i)[0];
    clean = clean.replace(/PISO\s*-?\s*$/i, '').replace(/DPTO\/INTERIOR\s*-?\s*$/i, '').trim();
    clean = clean.replace(/[\|,\s-]+$/, '').trim();
    return toTitleCase(clean);
};

export function formatMonthYearShort(dateStr?: string): string {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        return `${months[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(-2)}`;
    } catch {
        return '';
    }
}

export function getPlanDisplayName(visita?: VisitaItem): string {
    if (!visita) return 'Mi Servicio';
    let basePlan = '';
    if (visita.campana && visita.campana.includes('|')) {
        for (const part of visita.campana.split('|')) {
            const [k, ...v] = part.split(':');
            if (k && k.trim().toLowerCase() === 'paquete') {
                const val = v.join(':').trim();
                if (val && !/aprobado/i.test(val)) { basePlan = val; break; }
            }
        }
    }
    if (!basePlan) basePlan = visita.producto || visita.titulo || 'Plan Internet';
    basePlan = basePlan.replace(/\b(SGI|SGA|SGM|FTTH)\b/gi, '').trim();
    const dateTag = formatMonthYearShort(visita.fecha);
    return dateTag && !basePlan.toUpperCase().includes(dateTag) ? `${basePlan} - ${dateTag}` : basePlan;
}