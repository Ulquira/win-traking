import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    RotateCcw,
    Send,
    CheckCircle2,
    MessageCircle,
    Sparkles,
    CalendarDays,
    Navigation,
    ChevronRight,
    ExternalLink,
    ShieldCheck
} from "lucide-react";
import { InstalacionData } from "@/types/tracking";
import {
    parsePlanData,
    formatAddress,
    toTitleCase,
    formatTramoToRange
} from "@/utils/trackingFormatters";
import { trackEvent } from "@/lib/firebaseConfig";
import { API_BASE_URL } from "@/config/api";

interface HelpAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    token?: string;
    data: InstalacionData;
    onOpenReprogram: () => void;
    onCancelVisitSuccess?: () => void;
}

type AreaOperativa = 'Visita Técnica' | 'Instalaciones';
type ConsultaField = 'telefono' | 'titular' | 'direccion' | 'estado_datos';

type FlowStep =
    | 'step1_area'
    | 'menu_visita_tecnica'
    | 'menu_instalaciones'
    // Exclusivos Visita Técnica
    | 'vt_ya_no_necesito'
    | 'vt_input_otro_motivo'
    | 'vt_sin_disponibilidad'
    | 'vt_dir_step1_distrito'
    | 'vt_dir_step2_direccion'
    | 'vt_dir_step3_gps'
    // Compartido: Problema con un técnico
    | 'mod_problema_tecnico'
    | 'mod_input_otro_problema'
    // Consulta BD (Instalaciones / Visita Técnica)
    | 'mod_realizar_consulta'
    | 'mod_validar_consulta'
    // Compartido: Hablar con un asesor
    | 'mod_hablar_asesor'
    | 'mod_input_otro_asesor'
    // Cierre
    | 'end_flow';

interface ChatBubble {
    id: string;
    sender: 'bot' | 'user';
    text: string;
    badge?: string;
    wspUrl?: string;
}

export const HelpAssistantModal: React.FC<HelpAssistantModalProps> = ({
    isOpen,
    onClose,
    token,
    data,
    onOpenReprogram,
    onCancelVisitSuccess
}) => {
    const [step, setStep] = useState<FlowStep>('step1_area');
    const [area, setArea] = useState<AreaOperativa | null>(null);
    const [messages, setMessages] = useState<ChatBubble[]>([]);
    const [inputText, setInputText] = useState('');

    // Estados temporales para Dirección Incorrecta (Secuencial 1 -> 2 -> 3)
    const [distritoTemp, setDistritoTemp] = useState('');
    const [direccionTemp, setDireccionTemp] = useState('');
    const [isGettingGps, setIsGettingGps] = useState(false);

    // Estado temporal para Consulta BD con validación previa
    const [pendingQuery, setPendingQuery] = useState<{ field: ConsultaField; label: string } | null>(null);
    const [motivoActual, setMotivoActual] = useState<string>('Iniciado');

    const chatEndRef = useRef<HTMLDivElement>(null);

    const firstName = data.cliente_nombre
        ? toTitleCase(data.cliente_nombre.split(' ')[0])
        : 'Cliente';

    const expectedPin = data.pin_token
        ? String(data.pin_token).trim()
        : data.token_inicio
            ? String(data.token_inicio).replace(/\D/g, '').slice(0, 4)
            : null;

    // Detectar automáticamente el área según el tipo de servicio de la orden
    const detectServiceArea = (): AreaOperativa => {
        const tipoLower = (data.tipo || '').toLowerCase().trim();
        const srvUpper = (data.tipo_servicio || '').toUpperCase().trim();
        const prodUpper = (data.producto || '').toUpperCase().trim();
        const trabUpper = (data.tipo_trabajo || '').toUpperCase().trim();

        const isVisitaTecnica =
            tipoLower === 'ticket' ||
            tipoLower === 'postventa' ||
            srvUpper.includes('AVERIA') ||
            srvUpper.includes('POSTVENTA') ||
            prodUpper.includes('AVERIA') ||
            prodUpper.includes('POSTVENTA') ||
            prodUpper.includes('MOTO') ||
            (trabUpper !== '' && !trabUpper.includes('INSTALA'));

        return isVisitaTecnica ? 'Visita Técnica' : 'Instalaciones';
    };

    const initConversation = () => {
        const detectedArea = detectServiceArea();
        setArea(detectedArea);
        setStep(detectedArea === 'Visita Técnica' ? 'menu_visita_tecnica' : 'menu_instalaciones');
        setInputText('');
        setDistritoTemp('');
        setDireccionTemp('');
        setPendingQuery(null);
        setMessages([
            {
                id: 'welcome-1',
                sender: 'bot',
                badge: 'Asistente WIN',
                text:
                    detectedArea === 'Visita Técnica'
                        ? `¡Hola ${firstName}! 👋 Soy tu Asistente Virtual de WIN. ¿En qué podemos ayudarte hoy con tu **Visita Técnica**?`
                        : `¡Hola ${firstName}! 👋 Soy tu Asistente Virtual de WIN. ¿En qué podemos ayudarte hoy con tu **Instalación**?`
            }
        ]);
    };

    useEffect(() => {
        if (isOpen) {
            initConversation();
        }
    }, [isOpen]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, step]);

    const saveChatLog = (
        updatedMessages: ChatBubble[],
        motivo: string,
        nextStep: FlowStep,
        hasWspUrl: boolean
    ) => {
        if (!token) return;

        const mensajesFormateados = updatedMessages.map((m, idx) => ({
            orden: idx + 1,
            fecha_utc: new Date().toISOString(),
            emisor: m.sender === 'user' ? 'CLIENTE' : 'ASISTENTE_WIN',
            rol: m.sender === 'user' ? 'cliente' : 'bot',
            tipo: 'text',
            texto: m.text.replace(/\*\*/g, '')
        }));

        const estadoChat = hasWspUrl
            ? 'Derivado a Asesor'
            : nextStep === 'end_flow'
                ? 'Finalizado'
                : 'En Curso';

        fetch(`${API_BASE_URL}/api/chat-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                orden_id: data.idoperacion || null,
                codisegui: data.codisegui || null,
                phone: data.cliente_telefono || null,
                grupo_servicio: area || (data.tipo === 'ticket' ? 'Visita Técnica' : 'Instalaciones'),
                motivo,
                estado_chat: estadoChat,
                mensajes_json: mensajesFormateados
            }),
            keepalive: true
        }).catch(err => console.error('Error en /api/chat-log:', err));
    };

    const appendInteraction = (
        userText: string,
        botText: string,
        nextStep: FlowStep,
        badgeMotivo?: string,
        wspUrl?: string
    ) => {
        const newMotivo =
            step === 'menu_visita_tecnica' || step === 'menu_instalaciones'
                ? userText.replace(/^\d+\.\s*/, '')
                : badgeMotivo || motivoActual;

        setMotivoActual(newMotivo);

        const userBubble: ChatBubble = { id: `u-${Date.now()}`, sender: 'user', text: userText };
        const botBubble: ChatBubble = {
            id: `b-${Date.now() + 1}`,
            sender: 'bot',
            text: botText,
            badge: 'Asistente WIN',
            wspUrl
        };

        setMessages(prev => {
            const updated = [...prev, userBubble, botBubble];
            saveChatLog(updated, newMotivo, nextStep, Boolean(wspUrl));
            return updated;
        });
        setStep(nextStep);
    };

    // ==========================================================================
    // PASO 1: SEGMENTACIÓN INICIAL POR ÁREA (1. Visita Técnica | 2. Instalaciones)
    // ==========================================================================
    const handleSelectArea = (selectedArea: AreaOperativa, label: string) => {
        setArea(selectedArea);
        trackEvent('ayuda_segmentacion_area', { token, area: selectedArea });

        if (selectedArea === 'Visita Técnica') {
            appendInteraction(
                label,
                'Has seleccionado **Visita Técnica**. ¿En qué podemos ayudarte hoy?',
                'menu_visita_tecnica',
                'Área: Visita Técnica'
            );
        } else {
            appendInteraction(
                label,
                'Has seleccionado **Instalaciones**. ¿En qué podemos ayudarte con tu instalación?',
                'menu_instalaciones',
                'Área: Instalaciones'
            );
        }
    };

    // ==========================================================================
    // ÁREA A: SUBMENÚ Y FLUJOS DE VISITA TÉCNICA
    // ==========================================================================
    const handleMenuVisitaTecnica = (opcion: 'ya_no_necesito' | 'direccion' | 'problema_tecnico' | 'asesor' | 'consulta', label: string) => {
        trackEvent('ayuda_opcion_visita_tecnica', { token, area: 'Visita Técnica', opcion });

        switch (opcion) {
            case 'ya_no_necesito':
                appendInteraction(
                    label,
                    '¿Por qué motivo ya no necesitas la visita técnica?',
                    'vt_ya_no_necesito',
                    'Visita Técnica'
                );
                break;
            case 'direccion':
                appendInteraction(
                    label,
                    'Vamos a actualizar la ubicación de tu visita paso a paso.\n\n**Paso 1 de 3:** Por favor, escribe el **Distrito** correcto:',
                    'vt_dir_step1_distrito',
                    'Visita Técnica • Ubicación'
                );
                break;
            case 'problema_tecnico':
                appendInteraction(
                    label,
                    'Lamentamos lo sucedido. Por favor, selecciona el inconveniente ocurrido con el técnico:',
                    'mod_problema_tecnico',
                    'Visita Técnica • Calidad'
                );
                break;
            case 'asesor':
                appendInteraction(
                    label,
                    'Antes de derivarte con un especialista, selecciona el motivo por el cual deseas hablar con un asesor:',
                    'mod_hablar_asesor',
                    'Visita Técnica • Asesor'
                );
                break;
            case 'consulta':
                appendInteraction(
                    label,
                    '¿Qué información de tu ticket de visita técnica deseas consultar?',
                    'mod_realizar_consulta',
                    'Visita Técnica • Consulta BD'
                );
                break;
        }
    };

    const handleVtYaNoNecesito = (motivo: 'ok' | 'otro' | 'sin_disponibilidad', label: string) => {
        if (motivo === 'ok') {
            trackEvent('ayuda_vt_ticket_resuelto', {
                token,
                area: 'Visita Técnica',
                accion: 'Ticket actualizado a Resuelto'
            });
            appendInteraction(
                label,
                '✅ ¡Qué buena noticia! Hemos actualizado tu ticket a **Resuelto**. Muchas gracias por notificarnos y que sigas disfrutando de tu conexión WIN.',
                'end_flow'
            );
            if (onCancelVisitSuccess) onCancelVisitSuccess();
        } else if (motivo === 'otro') {
            appendInteraction(
                label,
                'Por favor, escribe a continuación el motivo por el cual ya no necesitas la visita técnica:',
                'vt_input_otro_motivo'
            );
        } else if (motivo === 'sin_disponibilidad') {
            appendInteraction(
                label,
                'Entendemos que no cuentas con disponibilidad en este horario. ¿Qué deseas hacer?',
                'vt_sin_disponibilidad'
            );
        }
    };

    const handleVtDisponibilidad = (accion: 'no_desea' | 'reprogramar', label: string) => {
        if (accion === 'no_desea') {
            trackEvent('ayuda_vt_flujo_cancelado', {
                token,
                area: 'Visita Técnica',
                accion: 'Mover flujo a Cancelado'
            });
            appendInteraction(
                label,
                'Hemos movido tu solicitud a **Cancelado**. Si en otro momento necesitas retomar la visita técnica, estaremos a tu disposición.',
                'end_flow'
            );
            if (onCancelVisitSuccess) onCancelVisitSuccess();
        } else {
            trackEvent('ayuda_vt_redirigir_reprogramacion', { token, area: 'Visita Técnica' });
            onClose();
            onOpenReprogram();
        }
    };

    // Paso 3 de Dirección Incorrecta (Coordenada GPS Opcional)
    const guardarDireccionVisitaTecnica = (gpsCoords: string | null, userLabel: string) => {
        trackEvent('ayuda_vt_guardar_direccion', {
            token,
            area: 'Visita Técnica',
            distrito: distritoTemp,
            direccion_referencia: direccionTemp,
            coordenada_gps: gpsCoords || 'Omitido'
        });

        appendInteraction(
            userLabel,
            `✅ **Ubicación actualizada con éxito:**\n• **Distrito:** ${toTitleCase(distritoTemp)}\n• **Dirección y ref.:** ${direccionTemp}${gpsCoords ? `\n• **Coordenada GPS:** ${gpsCoords}` : '\n• **Coordenada GPS:** Omitida'
            }\n\nHemos guardado los datos en tu ticket de Visita Técnica.`,
            'end_flow'
        );
    };

    const handleCaptureGpsOptional = () => {
        if (!('geolocation' in navigator)) {
            guardarDireccionVisitaTecnica(null, 'Omitir (GPS no disponible)');
            return;
        }

        setIsGettingGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setIsGettingGps(false);
                const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                guardarDireccionVisitaTecnica(coords, `Confirmar Coordenada GPS (${coords})`);
            },
            () => {
                setIsGettingGps(false);
                guardarDireccionVisitaTecnica(null, 'Omitir');
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    // ==========================================================================
    // ÁREA B: SUBMENÚ Y FLUJOS DE INSTALACIONES
    // ==========================================================================
    const handleMenuInstalaciones = (opcion: 'problema_tecnico' | 'consulta' | 'asesor', label: string) => {
        trackEvent('ayuda_opcion_instalaciones', { token, area: 'Instalaciones', opcion });

        switch (opcion) {
            case 'problema_tecnico':
                appendInteraction(
                    label,
                    'Lamentamos lo sucedido. Por favor, selecciona el inconveniente ocurrido con el técnico:',
                    'mod_problema_tecnico',
                    'Instalaciones • Calidad'
                );
                break;
            case 'consulta':
                appendInteraction(
                    label,
                    '¿Qué información de tu instalación deseas consultar?',
                    'mod_realizar_consulta',
                    'Instalaciones • Consulta BD'
                );
                break;
            case 'asesor':
                appendInteraction(
                    label,
                    'Antes de derivarte con un especialista, selecciona el motivo por el cual deseas hablar con un asesor:',
                    'mod_hablar_asesor',
                    'Instalaciones • Asesor'
                );
                break;
        }
    };

    // ==========================================================================
    // MÓDULO COMPARTIDO: PROBLEMA CON UN TÉCNICO
    // ==========================================================================
    const handleSelectProblemaTecnico = (inconveniente: string, isOtro = false) => {
        const currentArea = area || 'Instalaciones';
        if (isOtro) {
            appendInteraction(
                inconveniente,
                'Por favor, describe brevemente el inconveniente ocurrido con el técnico:',
                'mod_input_otro_problema',
                `${currentArea} • Calidad`
            );
            return;
        }

        trackEvent('ayuda_registro_incidente_tecnico', {
            token,
            area: currentArea,
            inconveniente,
            tecnico: data.tecnico?.nombre || 'Sin asignar',
            cuadrilla: data.tecnico?.cuadrilla || 'Sin cuadrilla'
        });

        appendInteraction(
            inconveniente,
            `✅ **Incidente registrado en ${currentArea}:**\nHemos asociado el reporte ("${inconveniente}") a tu orden #${data.codisegui || data.idoperacion || ''
            } para que nuestro equipo supervisor tome las medidas correspondientes.`,
            'end_flow'
        );
    };

    // ==========================================================================
    // MÓDULO: REALIZAR UNA CONSULTA (CONEXIÓN A BASE DE DATOS + VALIDACIÓN)
    // ==========================================================================
    const handleInitiateConsulta = (field: ConsultaField, label: string) => {
        setPendingQuery({ field, label });
        const promptMsg = expectedPin
            ? '🔒 Por tu seguridad, ingresa tu **código PIN de 4 dígitos** (o los últimos 4 dígitos de tu teléfono registrado) para validar tu identidad y consultar en la Base de Datos:'
            : '🔒 Por tu seguridad, escribe tu **nombre o los últimos 4 dígitos de tu teléfono** para validar tu identidad:';

        appendInteraction(label, promptMsg, 'mod_validar_consulta', `${area || 'Consulta'} • Validación`);
    };

    const ejecutarConsultaBaseDeDatos = (field: ConsultaField, validationInput: string) => {
        const currentArea = area || 'Instalaciones';
        const dbSource = currentArea === 'Visita Técnica' ? 'query_db_visita_tecnica' : 'query_db_instalaciones';

        trackEvent(dbSource, {
            token,
            area: currentArea,
            campo_consultado: field
        });

        const estadoLegible: Record<string, string> = {
            programada: 'Programada / Agendada',
            asignado: 'Técnico Asignado',
            en_camino: 'En Camino a tu domicilio',
            en_proceso: 'En Proceso de atención',
            finalizada: 'Finalizada',
            cerrada: 'Cerrada'
        };

        let respuestaDato = '';
        if (field === 'telefono') {
            respuestaDato = `📱 **Número de teléfono registrado:**\n${data.cliente_telefono || 'No figura teléfono móvil en la orden actual'}`;
        } else if (field === 'titular') {
            respuestaDato = `👤 **Nombre del titular:**\n${toTitleCase(data.cliente_nombre || 'Titular WIN')}`;
        } else if (field === 'direccion') {
            respuestaDato = `📍 **Dirección registrada:**\n${formatAddress(data.direccion)}`;
        } else if (field === 'estado_datos') {
            const parsed = parsePlanData(data.campana);
            const paquete = parsed.paquete
                ? toTitleCase(parsed.paquete)
                : toTitleCase(data.producto || data.tipo_trabajo || data.campana || 'Servicio Fibra WIN');
            const svas = parsed.svas.length > 0 ? `\n• **Adicionales:** ${parsed.svas.join(', ')}` : '';
            const estadoActual = estadoLegible[data.status] || toTitleCase(data.status);
            const horario = data.tramo ? `\n• **Rango horario:** ${formatTramoToRange(data.tramo)}` : '';
            const codOrden = data.codisegui || data.idoperacion || 'Registrado';

            respuestaDato = `📋 **Estado y datos de tu ${currentArea.toLowerCase()}:**\n• **Estado actual:** ${estadoActual}\n• **Código / Ticket:** ${codOrden}\n• **Detalle del servicio:** ${paquete}${svas}${horario}`;
        }

        appendInteraction(
            `Validación: ${validationInput}`,
            `✅ Identidad validada.\n\n${respuestaDato}`,
            'end_flow',
            currentArea
        );
        setPendingQuery(null);
    };

    // ==========================================================================
    // MÓDULO COMPARTIDO: HABLAR CON UN ASESOR
    // ==========================================================================
    const finalizarDerivacionAsesor = (motivo: string) => {
        const currentArea: AreaOperativa = area || (data.tipo === 'ticket' ? 'Visita Técnica' : 'Instalaciones');
        const wspNumber = currentArea === 'Visita Técnica' ? '51922863186' : '51923229369';

        trackEvent('ayuda_hablar_con_asesor', {
            token,
            area: currentArea,
            motivo
        });

        const textoSaludo = `Hola, vengo del área de ${currentArea} y quiero hablar con un asesor por: ${motivo}`;
        const wspUrl = `https://wa.me/${wspNumber}?text=${encodeURIComponent(textoSaludo)}`;

        appendInteraction(
            motivo,
            `Hemos registrado tu motivo (**${motivo}**) en el área de **${currentArea}**. Haz clic en el botón de abajo si WhatsApp no se abre automáticamente:`,
            'end_flow',
            `${currentArea} • Derivación`,
            wspUrl
        );

        setTimeout(() => {
            window.open(wspUrl, '_blank');
        }, 500);
    };

    const handleSelectMotivoAsesor = (motivo: string, isOtro = false) => {
        if (isOtro) {
            appendInteraction(
                motivo,
                'Por favor, escribe brevemente el motivo por el cual deseas comunicarte con un asesor:',
                'mod_input_otro_asesor',
                `${area || 'Atención'} • Asesor`
            );
            return;
        }
        finalizarDerivacionAsesor(motivo);
    };

    // ==========================================================================
    // MANEJO DE CAMPOS ABIERTOS DE TEXTO (SECUENCIALES Y DETALLES)
    // ==========================================================================
    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = inputText.trim();
        if (!clean) return;

        // 1. Exclusivo Visita Técnica: "Ya no necesito ayuda -> Otro motivo"
        if (step === 'vt_input_otro_motivo') {
            setInputText('');
            trackEvent('ayuda_vt_otro_motivo_guardado', {
                token,
                area: 'Visita Técnica',
                motivo: clean
            });
            appendInteraction(
                clean,
                '✅ Hemos guardado tu respuesta. ¡Gracias por informarnos!',
                'end_flow'
            );
            return;
        }

        // 2. Exclusivo Visita Técnica: "Dirección incorrecta" (Paso 1 -> Distrito)
        if (step === 'vt_dir_step1_distrito') {
            setInputText('');
            setDistritoTemp(clean);
            appendInteraction(
                clean,
                `Distrito registrado: **${toTitleCase(clean)}**.\n\n**Paso 2 de 3:** Ahora escribe tu **Dirección correcta y referencia**:`,
                'vt_dir_step2_direccion'
            );
            return;
        }

        // 3. Exclusivo Visita Técnica: "Dirección incorrecta" (Paso 2 -> Dirección y referencia)
        if (step === 'vt_dir_step2_direccion') {
            setInputText('');
            setDireccionTemp(clean);
            appendInteraction(
                clean,
                '**Paso 3 de 3 (Opcional):** ¿Deseas confirmar tu **Coordenada GPS** actual? Este paso es totalmente **OPCIONAL** (puedes tocar o escribir "Omitir").',
                'vt_dir_step3_gps'
            );
            return;
        }

        // 4. Si en el Paso 3 de GPS el usuario escribe "Omitir" manualmente
        if (step === 'vt_dir_step3_gps') {
            setInputText('');
            guardarDireccionVisitaTecnica(null, clean);
            return;
        }

        // 5. Módulo Problema con un técnico -> Otro inconveniente
        if (step === 'mod_input_otro_problema') {
            setInputText('');
            const currentArea = area || 'Instalaciones';
            trackEvent('ayuda_registro_incidente_tecnico', {
                token,
                area: currentArea,
                inconveniente: `Otro: ${clean}`,
                tecnico: data.tecnico?.nombre || 'Sin asignar'
            });
            appendInteraction(
                clean,
                `✅ **Incidente registrado en ${currentArea}:**\nHemos guardado el detalle de tu reporte en el sistema para el seguimiento de supervisión.`,
                'end_flow'
            );
            return;
        }

        // 6. Validación antes de consultar en Base de Datos
        if (step === 'mod_validar_consulta' && pendingQuery) {
            const cleanDigits = clean.replace(/\D/g, '');
            const phoneLast4 = (data.cliente_telefono || '').replace(/\D/g, '').slice(-4);
            const isValidPin = expectedPin && clean === expectedPin;
            const isValidPhone = phoneLast4 && cleanDigits.length === 4 && cleanDigits === phoneLast4;
            const isValidName =
                data.cliente_nombre &&
                clean.length >= 3 &&
                data.cliente_nombre.toLowerCase().includes(clean.toLowerCase());

            if (expectedPin && !isValidPin && !isValidPhone && !isValidName) {
                setInputText('');
                setMessages(prev => [
                    ...prev,
                    { id: `u-${Date.now()}`, sender: 'user', text: clean },
                    {
                        id: `b-${Date.now() + 1}`,
                        sender: 'bot',
                        text: '⚠️ El código o dato ingresado no coincide con el titular de la orden. Por favor, ingresa el **PIN de 4 dígitos** que aparece en tu pantalla de seguimiento (o el primer nombre del titular):'
                    }
                ]);
                return;
            }

            setInputText('');
            ejecutarConsultaBaseDeDatos(pendingQuery.field, clean);
            return;
        }

        // 7. Módulo Hablar con un asesor -> Otro motivo
        if (step === 'mod_input_otro_asesor') {
            setInputText('');
            finalizarDerivacionAsesor(clean);
            return;
        }
    };

    const isTextInputVisible =
        step === 'vt_input_otro_motivo' ||
        step === 'vt_dir_step1_distrito' ||
        step === 'vt_dir_step2_direccion' ||
        step === 'vt_dir_step3_gps' ||
        step === 'mod_input_otro_problema' ||
        step === 'mod_validar_consulta' ||
        step === 'mod_input_otro_asesor';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex flex-col justify-end font-sans">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-[#26292E]/45 backdrop-blur-[2px]"
                    />

                    {/* Contenedor Principal del Asistente */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 280 }}
                        className="relative z-10 w-full max-w-md mx-auto bg-[#F8F9FB] rounded-t-[28px] shadow-2xl flex flex-col max-h-[86dvh] overflow-hidden border-t border-gray-100"
                    >
                        {/* Drag Handle */}
                        <div className="w-full bg-white flex justify-center pt-2.5 pb-1 shrink-0">
                            <div className="w-10 h-1 bg-[#D9D9D9] rounded-full" />
                        </div>

                        {/* Cabecera */}
                        <div className="bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#FFF0E6] border border-[#FFD8C2] flex items-center justify-center text-[#FF5A0A] shrink-0">
                                    <Sparkles className="w-4 h-4 fill-[#FF5A0A]" />
                                </div>
                                <h3 className="text-[15px] font-bold text-[#26292E] leading-tight">
                                    Asistente Virtual WIN
                                </h3>
                            </div>

                            <div className="flex items-center gap-1">
                                {step !== 'menu_visita_tecnica' && step !== 'menu_instalaciones' && (
                                    <button
                                        type="button"
                                        onClick={initConversation}
                                        title="Volver al menú principal"
                                        className="p-2 rounded-full text-gray-400 hover:text-[#FF5A0A] hover:bg-orange-50 transition-colors cursor-pointer"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Cerrar"
                                    className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Historial de Conversación */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                            {messages.map((m) => (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                                >
                                    {m.badge && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF5A0A] bg-[#FFEFE7] px-2.5 py-0.5 rounded-full mb-1">
                                            {m.badge}
                                        </span>
                                    )}
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap shadow-2xs ${m.sender === 'user'
                                            ? 'bg-[#FF5A0A] text-white font-semibold rounded-br-xs'
                                            : 'bg-white text-[#26292E] border border-gray-100 rounded-bl-xs'
                                            }`}
                                    >
                                        {m.text.split('**').map((part, index) =>
                                            index % 2 === 1 ? <strong key={index} className="font-bold">{part}</strong> : part
                                        )}

                                        {m.wspUrl && (
                                            <a
                                                href={m.wspUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-3 w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-[12px] shadow-xs transition-all"
                                            >
                                                <MessageCircle className="w-4 h-4 fill-white" />
                                                <span>Abrir WhatsApp con Asesor</span>
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {/* CONTROLES INTERACTIVOS POR PASO */}
                            <div className="pt-1 space-y-2">
                                {/* PASO 1: SEGMENTACIÓN INICIAL (Únicamente 2 opciones) */}
                                {step === 'step1_area' && (
                                    <div className="grid grid-cols-1 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectArea('Visita Técnica', '1. Visita Técnica')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] active:scale-[0.99] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3.5 text-left text-[13.5px] font-bold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all shadow-2xs cursor-pointer group"
                                        >
                                            <span>1. Visita Técnica</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSelectArea('Instalaciones', '2. Instalaciones')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] active:scale-[0.99] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3.5 text-left text-[13.5px] font-bold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all shadow-2xs cursor-pointer group"
                                        >
                                            <span>2. Instalaciones</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                    </div>
                                )}

                                {/* ÁREA A: SUBMENÚ VISITA TÉCNICA */}
                                {step === 'menu_visita_tecnica' && (
                                    <div className="grid grid-cols-1 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleMenuVisitaTecnica('ya_no_necesito', '1. Ya no necesito ayuda')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>1. Ya no necesito ayuda</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMenuVisitaTecnica('direccion', '2. Dirección incorrecta')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>2. Dirección incorrecta</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMenuVisitaTecnica('problema_tecnico', '3. Problema con un técnico')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>3. Problema con un técnico</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMenuVisitaTecnica('asesor', '4. Hablar con un asesor')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>4. Hablar con un asesor</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMenuVisitaTecnica('consulta', '5. Realizar una consulta')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>5. Realizar una consulta</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                    </div>
                                )}

                                {/* ÁREA B: SUBMENÚ INSTALACIONES (Únicamente 3 opciones estrictas) */}
                                {step === 'menu_instalaciones' && (
                                    <div className="grid grid-cols-1 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleMenuInstalaciones('problema_tecnico', '1. Problema con un técnico')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>1. Problema con un técnico</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMenuInstalaciones('consulta', '2. Realizar una consulta')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>2. Realizar una consulta</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMenuInstalaciones('asesor', '3. Hablar con un asesor')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>3. Hablar con un asesor</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                    </div>
                                )}

                                {/* FLUJO VISITA TÉCNICA: YA NO NECESITO AYUDA */}
                                {step === 'vt_ya_no_necesito' && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleVtYaNoNecesito('ok', 'Mi servicio ya está OK')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            Mi servicio ya está OK
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVtYaNoNecesito('otro', 'Otro motivo')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            Otro motivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVtYaNoNecesito('sin_disponibilidad', 'No tengo disponibilidad')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            No tengo disponibilidad
                                        </button>
                                    </div>
                                )}

                                {/* FLUJO VISITA TÉCNICA: NO TENGO DISPONIBILIDAD */}
                                {step === 'vt_sin_disponibilidad' && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleVtDisponibilidad('no_desea', '1. No desea')}
                                            className="w-full bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-300 rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-rose-600 transition-all cursor-pointer"
                                        >
                                            1. No desea
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVtDisponibilidad('reprogramar', '2. Reprogramar')}
                                            className="w-full bg-[#FF5A0A] hover:bg-[#E04E07] text-white rounded-xl px-4 py-3 text-left text-[13px] font-bold flex items-center justify-between transition-all shadow-sm cursor-pointer"
                                        >
                                            <span className="flex items-center gap-2">
                                                <CalendarDays className="w-4 h-4" />
                                                2. Reprogramar (Fecha y hora)
                                            </span>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {/* FLUJO VISITA TÉCNICA: DIRECCIÓN INCORRECTA PASO 3 (GPS OPCIONAL) */}
                                {step === 'vt_dir_step3_gps' && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            disabled={isGettingGps}
                                            onClick={handleCaptureGpsOptional}
                                            className="w-full bg-[#FF5A0A] hover:bg-[#E04E07] disabled:opacity-60 text-white rounded-xl px-4 py-3 text-[13px] font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                                        >
                                            <Navigation className="w-4 h-4" />
                                            <span>{isGettingGps ? 'Obteniendo ubicación GPS...' : 'Confirmar Coordenada GPS'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isGettingGps}
                                            onClick={() => guardarDireccionVisitaTecnica(null, 'Omitir')}
                                            className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-gray-600 transition-all cursor-pointer text-center"
                                        >
                                            Omitir (Guardar sin GPS)
                                        </button>
                                    </div>
                                )}

                                {/* MÓDULO COMPARTIDO: PROBLEMA CON UN TÉCNICO */}
                                {step === 'mod_problema_tecnico' && (
                                    <div className="flex flex-col gap-2">
                                        {[
                                            'El técnico no llegó en el horario acordado.',
                                            'Mal trato o actitud inadecuada.',
                                            'Trabajo incompleto o mala instalación/reparación.'
                                        ].map((inc) => (
                                            <button
                                                key={inc}
                                                type="button"
                                                onClick={() => handleSelectProblemaTecnico(inc, false)}
                                                className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                            >
                                                {inc}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => handleSelectProblemaTecnico('Otro inconveniente', true)}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            Otro inconveniente
                                        </button>
                                    </div>
                                )}

                                {/* MÓDULO: REALIZAR UNA CONSULTA (4 OPCIONES) */}
                                {step === 'mod_realizar_consulta' && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleInitiateConsulta('telefono', '1. Número de teléfono registrado')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            1. Número de teléfono registrado
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleInitiateConsulta('titular', '2. Nombre del titular')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            2. Nombre del titular
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleInitiateConsulta('direccion', '3. Dirección registrada')}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            3. Dirección registrada
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleInitiateConsulta(
                                                    'estado_datos',
                                                    area === 'Visita Técnica'
                                                        ? '4. Estado u otros datos de la visita técnica'
                                                        : '4. Estado u otros datos de la instalación'
                                                )
                                            }
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] transition-all cursor-pointer"
                                        >
                                            {area === 'Visita Técnica'
                                                ? '4. Estado u otros datos de la visita técnica'
                                                : '4. Estado u otros datos de la instalación'}
                                        </button>
                                    </div>
                                )}

                                {/* Botón rápido de validación si el cliente ya está autenticado con su link único */}
                                {step === 'mod_validar_consulta' && pendingQuery && (
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                ejecutarConsultaBaseDeDatos(
                                                    pendingQuery.field,
                                                    expectedPin || ' Enlace Único Verificado'
                                                )
                                            }
                                            className="w-full bg-[#FFF6ED] hover:bg-[#FFEFE0] border border-[#FFD8C2] text-[#FF5A0A] rounded-xl px-4 py-2.5 text-[12px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>Validar automáticamente con mi enlace seguro</span>
                                        </button>
                                    </div>
                                )}

                                {/* MÓDULO COMPARTIDO: HABLAR CON UN ASESOR */}
                                {step === 'mod_hablar_asesor' && (
                                    <div className="flex flex-col gap-2">
                                        {[
                                            'Consulta de horarios o demora en la atención',
                                            'Problemas con la orden / facturación',
                                            'Modificación de datos o traslado'
                                        ].map((mot) => (
                                            <button
                                                key={mot}
                                                type="button"
                                                onClick={() => handleSelectMotivoAsesor(mot, false)}
                                                className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                            >
                                                <span>{mot}</span>
                                                <MessageCircle className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform shrink-0 ml-2" />
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => handleSelectMotivoAsesor('Otro motivo', true)}
                                            className="w-full bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-left text-[13px] font-semibold text-[#26292E] hover:text-[#FF5A0A] flex items-center justify-between transition-all cursor-pointer group"
                                        >
                                            <span>Otro motivo</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF5A0A]" />
                                        </button>
                                    </div>
                                )}

                                {/* FIN DEL FLUJO */}
                                {step === 'end_flow' && (
                                    <div className="pt-2 flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={initConversation}
                                            className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-full h-11 text-[13px] font-bold text-[#26292E] flex items-center justify-center gap-2 transition-all cursor-pointer"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>Volver al menú principal</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="w-full bg-[#FF5A0A] hover:bg-[#E04E07] text-white rounded-full h-11 text-[13px] font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Finalizar y cerrar</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div ref={chatEndRef} />
                        </div>

                        {/* Barra de Entrada de Texto (Solo visible en pasos de campo abierto o validación) */}
                        {isTextInputVisible && (
                            <form
                                onSubmit={handleTextSubmit}
                                className="bg-white p-3 border-t border-gray-100 flex items-center gap-2 shrink-0"
                            >
                                <input
                                    type="text"
                                    autoFocus
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder={
                                        step === 'vt_dir_step1_distrito'
                                            ? 'Escribe el distrito (Ej: Surco, San Isidro)...'
                                            : step === 'vt_dir_step2_direccion'
                                                ? 'Escribe la dirección exacta y referencia...'
                                                : step === 'vt_dir_step3_gps'
                                                    ? 'Escribe "Omitir" o usa los botones de arriba...'
                                                    : step === 'mod_validar_consulta'
                                                        ? 'Ingresa tu PIN de 4 dígitos...'
                                                        : 'Escribe el detalle aquí...'
                                    }
                                    className="flex-1 h-11 bg-[#F5F6F8] border border-gray-200 rounded-full px-4 text-[13px] text-[#26292E] focus:outline-none focus:border-[#FF5A0A]"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="w-11 h-11 rounded-full bg-[#FF5A0A] disabled:bg-gray-200 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};