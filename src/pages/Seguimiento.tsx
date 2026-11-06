import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Bell, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

import GoogleTrackingMap from "@/components/GoogleTrackingMap";
import { MainLogo } from "@/components/MainLogo";
import { trackEvent } from "@/lib/firebaseConfig";
import { API_BASE_URL } from "@/config/api";
import { InstalacionData, NotificationItem, EncuestaAppState } from "@/types/tracking";
import {
    parseSafeDate,
    formatTramoToRange,
    parsePlanData,
    toTitleCase,
    formatSvaName,
    formatPostventaServices,
    formatMaskedDni,
    extractTechnicianName,
    formatAddress
} from "@/utils/trackingFormatters";
import { SvaServiceIcon } from "@/components/seguimiento/SvaServiceIcon";
import {
    SurveyCompletedScreen,
    ReprogramCompletedScreen,
    ClosedVisitScreen
} from "@/components/seguimiento/StatusResultScreens";
import { CancelAttentionModal } from "@/components/seguimiento/CancelAttentionModal";
import { TechnicianPhotoModal } from "@/components/seguimiento/TechnicianPhotoModal";
import { SurveyBottomSheet } from "@/components/seguimiento/SurveyBottomSheet";
import { ReprogramFlowModals, ReprogramStep } from "@/components/seguimiento/ReprogramFlowModals";
import { HelpAssistantModal } from "@/components/seguimiento/HelpAssistantModal";

export type { InstalacionData };

interface SeguimientoProps {
    customToken?: string;
    renderServiceSelector?: () => React.ReactNode;
}

const Seguimiento = ({ customToken, renderServiceSelector }: SeguimientoProps = {}) => {
    const { token: paramToken } = useParams<{ token: string }>();
    const token = customToken || paramToken;
    const navigate = useNavigate();

    const [data, setData] = useState<InstalacionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [calculatedEta, setCalculatedEta] = useState<string | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isReprogramModalOpen, setIsReprogramModalOpen] = useState(false);
    const [isReprogramCompletada, setIsReprogramCompletada] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [hasImageError, setHasImageError] = useState(false);
    const [reprogramStep, setReprogramStep] = useState<ReprogramStep>('form');

    const [encuestaApp, setEncuestaApp] = useState<EncuestaAppState>({
        satisfaccion_atencion: 0,
        facilidad_uso: 0,
        satisfaccion_experiencia: 0,
        seguridad_datos_tecnico: '',
        comentarios: ''
    });
    const [isSubmittingEncuesta, setIsSubmittingEncuesta] = useState(false);
    const [encuestaEnviada, setEncuestaEnviada] = useState(false);
    const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(true);
    const [pinCopied, setPinCopied] = useState(false);

    const previousStatus = useRef<string | null>(null);
    const previousTechnician = useRef<string | null>(null);
    const etaReferenceTime = useRef<number | null>(null);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [sheetHeight, setSheetHeight] = useState(15);

    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    // Registrar tiempo de estadía y si refrescó la página
    useEffect(() => {
        if (!token) return;
        let startTime = Date.now();

        const isReload =
            window.performance &&
            (window.performance.getEntriesByType("navigation")[0] as any)?.type === "reload";
        if (isReload) {
            trackEvent('pagina_refrescada', { token });
        }

        const sendDurationLog = () => {
            const endTime = Date.now();
            const durationSeconds = Math.round((endTime - startTime) / 1000);
            if (durationSeconds <= 0) return;

            const logData = JSON.stringify({
                token,
                evento: 'visita_finalizada',
                detalles: { duracion_segundos: durationSeconds }
            });

            fetch(`${API_BASE_URL}/api/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: logData,
                keepalive: true
            }).catch(err => console.error("Error al registrar duracion:", err));
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                sendDurationLog();
            } else if (document.visibilityState === 'visible') {
                startTime = Date.now();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            sendDurationLog();
        };
    }, [token]);

    const triggerNotification = (newStatus: string, tecnicoData: any) => {
        const title = "¡Actualización de tu servicio!";
        let body = "";
        switch (newStatus) {
            case 'asignado':
                body = `El técnico ${tecnicoData?.nombre || ''} ha sido asignado a tu instalación.`;
                break;
            case 'en_camino':
                body = "Tu técnico ya está en camino a tu domicilio. Revisa el mapa.";
                break;
            case 'en_proceso':
                body = "La instalación está en proceso en este momento.";
                break;
            case 'finalizada':
                body = "Instalación completada. Por favor evalúa nuestro servicio.";
                break;
            default:
                return;
        }

        setNotifications(prev => [{ title, body, time: new Date(), read: false }, ...prev]);

        const notificationOptions: any = {
            body,
            icon: '/win-icon.png',
            badge: '/win-icon.png',
            vibrate: [200, 100, 200],
            tag: `win-status-${newStatus}`,
            renotify: true
        };

        if ("Notification" in window && Notification.permission === "granted") {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready
                    .then(registration => registration.showNotification(title, notificationOptions))
                    .catch(() => new Notification(title, notificationOptions));
            } else {
                new Notification(title, notificationOptions);
            }
        }
    };

    const triggerTechnicianChangeNotification = (newTechName: string) => {
        const title = "¡Actualización de técnico!";
        const body = `Tu atención ha sido asignada al técnico ${toTitleCase(newTechName)}.`;

        setNotifications(prev => [{ title, body, time: new Date(), read: false }, ...prev]);

        const notificationOptions: any = {
            body,
            icon: '/win-icon.png',
            badge: '/win-icon.png',
            vibrate: [200, 100, 200],
            tag: `win-tech-change-${Date.now()}`,
            renotify: true
        };

        if ("Notification" in window && Notification.permission === "granted") {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready
                    .then(registration => registration.showNotification(title, notificationOptions))
                    .catch(() => new Notification(title, notificationOptions));
            } else {
                new Notification(title, notificationOptions);
            }
        }
    };

    const handleCopyPin = (textToCopy: string) => {
        if (!textToCopy) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).catch(() => { });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
            } catch { }
            document.body.removeChild(textarea);
        }
        setPinCopied(true);
        setTimeout(() => setPinCopied(false), 2000);
    };

    const handleEncuestaSubmit = async () => {
        if (
            !encuestaApp.satisfaccion_atencion ||
            !encuestaApp.facilidad_uso ||
            !encuestaApp.satisfaccion_experiencia ||
            !encuestaApp.seguridad_datos_tecnico
        ) {
            alert("Por favor responde todas las preguntas antes de enviar.");
            return;
        }

        setIsSubmittingEncuesta(true);

        try {
            const payload = {
                token,
                orden_id: data?.idoperacion || null,
                codisegui: data?.codisegui || null,
                satisfaccion_atencion: encuestaApp.satisfaccion_atencion,
                facilidad_uso: encuestaApp.facilidad_uso,
                satisfaccion_experiencia: encuestaApp.satisfaccion_experiencia,
                seguridad_datos_tecnico: encuestaApp.seguridad_datos_tecnico,
                comentarios: encuestaApp.comentarios
            };

            const response = await fetch(`${API_BASE_URL}/api/encuesta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                trackEvent('encuesta_completada', {
                    token,
                    satisfaccion_atencion: encuestaApp.satisfaccion_atencion,
                    facilidad_uso: encuestaApp.facilidad_uso,
                    satisfaccion_experiencia: encuestaApp.satisfaccion_experiencia,
                    seguridad_datos_tecnico: encuestaApp.seguridad_datos_tecnico
                });
                setEncuestaEnviada(true);
                setIsSurveyModalOpen(false);
                localStorage.setItem(`encuesta_completada_${token}`, 'true');
                setData(prev => (prev ? { ...prev, status: 'cerrada' } : null));
            } else {
                alert("Ocurrió un error. Por favor intenta de nuevo más tarde.");
            }
        } catch {
            alert("Error de conexión al guardar la encuesta.");
        } finally {
            setIsSubmittingEncuesta(false);
        }
    };

    // Contador regresivo local del ETA
    useEffect(() => {
        if (remainingSeconds === null || remainingSeconds <= 0) return;

        const interval = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev === null || prev <= 0) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [remainingSeconds]);

    // Formatear el ETA calculado cada vez que cambian los segundos restantes
    useEffect(() => {
        if (remainingSeconds === null) return;
        const totalSecsWithBuffer = remainingSeconds + 15 * 60;

        if (etaReferenceTime.current) {
            const arrivalTimeMin = new Date(etaReferenceTime.current + totalSecsWithBuffer * 1000);
            const arrivalTimeMax = new Date(arrivalTimeMin.getTime() + 20 * 60 * 1000);

            const timeFormatMin = arrivalTimeMin
                .toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })
                .toLowerCase();
            const timeFormatMax = arrivalTimeMax
                .toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })
                .toLowerCase();

            setCalculatedEta(`${timeFormatMin} - ${timeFormatMax}`);
        }
    }, [remainingSeconds]);

    // Polling de estado de instalación
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;

        const fetchInstalacion = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/instalaciones/${token}`);
                const result = await response.json();

                if (result.success) {
                    const fetchedData = result.data;
                    const dbStatus = fetchedData.status ? fetchedData.status.toLowerCase().trim() : '';
                    let mappedStatus = fetchedData.status;

                    switch (dbStatus) {
                        case 'pendiente':
                            mappedStatus = 'programada';
                            break;
                        case 'agendada':
                            mappedStatus = 'asignado';
                            break;
                        case 'en camino':
                            mappedStatus = 'en_camino';
                            break;
                        case 'iniciada':
                            mappedStatus = 'en_proceso';
                            break;
                        case 'finalizada':
                            mappedStatus = 'finalizada';
                            break;
                        case 'anulada':
                        case 'regestion':
                        case 'cancelada':
                        case 'revisión':
                        case 'revision':
                            mappedStatus = 'cerrada';
                            break;
                    }

                    fetchedData.status = mappedStatus;

                    const hasCompletedSurveyLocal = localStorage.getItem(`encuesta_completada_${token}`);
                    const hasCompletedReprogramLocal = localStorage.getItem(`reprogramacion_completada_${token}`);

                    if (hasCompletedReprogramLocal === 'true' || fetchedData.reprogramada) {
                        setIsReprogramCompletada(true);
                        if (fetchedData.reprogramada) {
                            localStorage.setItem(`reprogramacion_completada_${token}`, 'true');
                        }
                    }

                    if (hasCompletedSurveyLocal === 'true' || fetchedData.encuesta_completada) {
                        fetchedData.status = 'cerrada';
                        if (fetchedData.encuesta_completada) {
                            localStorage.setItem(`encuesta_completada_${token}`, 'true');
                        }
                    }

                    if (fetchedData.status === 'cerrada' && intervalId) {
                        clearInterval(intervalId);
                    }

                    if (previousStatus.current && previousStatus.current !== fetchedData.status) {
                        trackEvent('actualizacion_estado_visto', {
                            token,
                            estado_anterior: previousStatus.current,
                            estado_nuevo: fetchedData.status
                        });
                        triggerNotification(fetchedData.status, fetchedData.tecnico);
                    } else if (previousStatus.current === null) {
                        trackEvent('ver_seguimiento_instalacion', {
                            token,
                            estado_actual: fetchedData.status
                        });
                    }
                    previousStatus.current = fetchedData.status;

                    const currentTechName = fetchedData.tecnico?.nombre?.trim() || '';
                    if (
                        previousTechnician.current &&
                        currentTechName &&
                        previousTechnician.current !== currentTechName &&
                        currentTechName !== 'Técnico Asignado'
                    ) {
                        trackEvent('cambio_tecnico_detectado', {
                            token,
                            tecnico_anterior: previousTechnician.current,
                            tecnico_nuevo: currentTechName
                        });
                        triggerTechnicianChangeNotification(currentTechName);
                    }

                    if (currentTechName && currentTechName !== 'Técnico Asignado') {
                        previousTechnician.current = currentTechName;
                    }

                    setData(fetchedData);
                    setError(false);
                } else {
                    setError(true);
                }
            } catch (err) {
                console.error("Error fetching data", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                clearInterval(intervalId);
            } else if (document.visibilityState === "visible" && token) {
                fetchInstalacion();
                clearInterval(intervalId);
                intervalId = setInterval(fetchInstalacion, 10000);
            }
        };

        if (token) {
            fetchInstalacion();
            intervalId = setInterval(fetchInstalacion, 10000);
            document.addEventListener("visibilitychange", handleVisibilityChange);
        }

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [token]);

    if (loading) {
        return (
            <div className="h-[100dvh] w-full bg-[#f3f4f6] relative overflow-hidden flex flex-col font-sans">
                <div className="flex-1 bg-gray-200 animate-pulse"></div>
                <div className="absolute bottom-0 w-full h-[40vh] bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-8">
                    <div className="w-16 h-1.5 bg-gray-300 rounded-full mx-auto mb-8 animate-pulse"></div>
                    <div className="w-3/4 h-8 bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
                    <div className="w-1/2 h-4 bg-gray-200 rounded-lg mb-8 animate-pulse"></div>
                    <div className="w-full h-20 bg-gray-200 rounded-2xl animate-pulse"></div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] flex-col gap-4 font-sans px-6 text-center">
                <h1 className="text-3xl font-bold text-foreground">Instalación no encontrada</h1>
                <p className="text-muted-foreground text-lg">
                    El link de seguimiento proporcionado es inválido o la operación no existe.
                </p>
                <Button
                    onClick={() => navigate('/')}
                    className="mt-4 rounded-2xl h-14 px-8 bg-primary hover:bg-primary-light text-white font-bold text-lg"
                >
                    Volver al inicio
                </Button>
            </div>
        );
    }

    if (encuestaEnviada || localStorage.getItem(`encuesta_completada_${token}`) === 'true') {
        return <SurveyCompletedScreen />;
    }

    if (isReprogramCompletada) {
        return <ReprogramCompletedScreen />;
    }

    if (data.status === 'cerrada') {
        return <ClosedVisitScreen tipo={data.tipo} token={token} />;
    }

    const { status, tecnico, eta, fecha_programacion } = data;
    const position: [number, number] = data.coordenadas_cliente || [-12.0971, -77.0369];
    const vehiclePosition: [number, number] = data.coordenadas_tecnico || [-12.0950, -77.0320];

    const isVt = data.tipo === 'ticket';
    const isPostventa =
        data.tipo === 'postventa' ||
        Boolean(data.tipo_servicio && data.tipo_servicio.toUpperCase().includes('POSTVENTA')) ||
        Boolean(data.producto && data.producto.toUpperCase().includes('POSTVENTA')) ||
        Boolean(
            data.tipo_trabajo &&
            ['TRASLADO', 'RECABLEADO', 'CAMBIO DE ONT', 'REUBICACIÓN', 'CABLEADO DE MESH', '1 MESH', 'KIT WIFI PRO', 'WIN BOX'].some(
                t => data.tipo_trabajo?.toUpperCase().includes(t)
            )
        );

    const displayPin = data.pin_token
        ? String(data.pin_token).trim()
        : data.token_inicio
            ? String(data.token_inicio).replace(/\D/g, '').slice(0, 4) || String(data.token_inicio).slice(0, 4)
            : null;

    const steps = [
        { id: 'programada', label: 'Agendada', sub: 'Tu visita ha sido programada.', date: fecha_programacion },
        { id: 'asignado', label: 'Técnico Asignado', sub: 'Tenemos un técnico para ti.' },
        { id: 'en_camino', label: 'En Camino', sub: 'El técnico ya está en ruta.' },
        {
            id: 'en_proceso',
            label: 'Iniciada',
            sub: isPostventa
                ? 'Técnico realizando la atención.'
                : isVt
                    ? 'Técnico revisando avería.'
                    : 'Técnico revisando o instalando.'
        },
        {
            id: 'finalizada',
            label: 'Finalizada',
            sub: isPostventa
                ? 'Atención completada.'
                : isVt
                    ? 'Visita completada.'
                    : 'Instalación completada.'
        }
    ];

    const statusIndex = ['programada', 'asignado', 'en_camino', 'en_proceso', 'finalizada', 'cerrada'].indexOf(status);

    const handleDragEnd = (_e: any, info: any) => {
        if (info.offset.y < -30) {
            setSheetHeight(85);
        } else if (info.offset.y > 30) {
            setSheetHeight(13);
        }
    };

    const toggleSheet = () => {
        if (status === 'en_camino') {
            setSheetHeight(prev => (prev > 30 ? 15 : 85));
        }
    };

    return (
        <div className="h-[100dvh] w-full bg-[#f3f4f6] relative overflow-hidden font-sans">
            {/* Header Superior en Vista de Mapa */}
            {status === 'en_camino' && (
                <div className="absolute top-0 left-0 w-full z-20 pt-4 pb-3 px-4 bg-white/95 backdrop-blur-sm border-b border-gray-100 flex items-center justify-center shadow-xs">
                    <h1 className="text-[16px] font-bold text-[#FF5A0A] tracking-tight">
                        Seguimiento de la visita
                    </h1>
                </div>
            )}

            {/* Map Layer */}
            {status === 'en_camino' && (
                <div className="absolute top-0 left-0 w-full h-full z-0 bg-[#f5f5f5]">
                    <GoogleTrackingMap
                        customerCoords={position}
                        technicianCoords={vehiclePosition}
                        onRouteCalculated={(_coords, timeInSeconds) => {
                            if (remainingSeconds === null || Math.abs(remainingSeconds - timeInSeconds) > 300) {
                                setRemainingSeconds(timeInSeconds);
                                etaReferenceTime.current = Date.now();
                            }
                        }}
                        className="h-full w-full"
                    />

                    {/* Floating Pin Token Overlay */}
                    {displayPin && (
                        <div
                            className="absolute left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[365px] transition-all duration-300 pointer-events-auto cursor-pointer"
                            style={{
                                bottom: sheetHeight > 30 ? 'calc(85vh + 12px)' : '110px'
                            }}
                            onClick={() => handleCopyPin(displayPin)}
                            title={pinCopied ? "¡Código copiado!" : "Toca para copiar código"}
                        >
                            <div className="bg-[#FFF6ED] rounded-[18px] px-4 py-2.5 shadow-[0_4px_16px_rgba(255,90,10,0.14)] border border-[#FFE7D4] flex items-center justify-between gap-3 select-none active:scale-[0.99] transition-transform">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="w-8 h-8 rounded-full bg-[#FF5A0A]/10 flex items-center justify-center shrink-0">
                                        <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                            <path d="M19 8.25C19 12 16.375 13.875 13.255 14.9625C13.0916 15.0179 12.9142 15.0153 12.7525 14.955C9.625 13.875 7 12 7 8.25V3C7 2.80109 7.07902 2.61032 7.21967 2.46967C7.36032 2.32902 7.55109 2.25 7.75 2.25C9.25 2.25 11.125 1.35 12.43 0.210001C12.5889 0.0746002 12.791 0 13 0C13.209 0 13.4111 0.0746002 13.57 0.210001C14.8825 1.3575 16.75 2.25 18.25 2.25C18.4489 2.25 18.6397 2.32902 18.7803 2.46967C18.921 2.61032 19 2.80109 19 3V8.25Z" stroke="#FF5A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M10.75 7.5L12.25 9L15.25 6" stroke="#FF5A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div className="flex flex-col text-left min-w-0">
                                        <span className="text-[14px] font-bold text-[#FF5A0A] leading-tight">Código de validación</span>
                                        <span className="text-[11px] text-[#FF5A0A] leading-tight mt-0.5 font-normal truncate">
                                            {pinCopied ? "¡Código copiado al portapapeles!" : "Brinda este código al técnico para iniciar tu visita"}
                                        </span>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center">
                                    <span className="text-[20px] font-extrabold text-[#FF5A0A] tracking-[0.18em] font-sans">
                                        {displayPin.split('').join(' ')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Dynamic Content Container */}
            <motion.div
                animate={{
                    height: status === 'en_camino' ? (sheetHeight > 30 ? '85vh' : 'auto') : '100vh'
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                drag={status === 'en_camino' ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className={`absolute left-0 bottom-0 w-full bg-white shadow-[0_-10px_25px_rgba(0,0,0,0.12)] z-20 flex flex-col ${status === 'en_camino' ? 'rounded-t-[28px]' : 'rounded-none top-0 pt-0'
                    }`}
            >
                {/* Top Banner Orange */}
                {status !== 'en_camino' && (
                    <div className="bg-[#FF5A0A] w-full pt-6 pb-5 px-5 text-white shrink-0 relative z-30 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-center w-full">
                            <div className="flex flex-col items-start gap-0.5">
                                <MainLogo white className="h-7 sm:h-9" />
                                <h1 className="text-[17px] font-bold tracking-tight leading-tight mt-0.5">
                                    {data?.cliente_nombre ? `Hola, ${data.cliente_nombre.split(' ')[0].toUpperCase()}` : 'Detalle de visita'}
                                </h1>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setShowNotifications(!showNotifications);
                                        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                    }}
                                    className="relative p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer active:scale-95"
                                >
                                    <Bell className="w-6 h-6 text-white fill-white" />
                                    {notifications.some(n => !n.read) && (
                                        <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-primary"></div>
                                    )}
                                </button>

                                <AnimatePresence>
                                    {showNotifications && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 text-left"
                                        >
                                            <div className="p-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-800 text-sm">
                                                Notificaciones
                                            </div>
                                            <div className="max-h-60 overflow-y-auto">
                                                {notifications.length === 0 ? (
                                                    <div className="p-4 text-center text-sm text-gray-500">No hay notificaciones recientes</div>
                                                ) : (
                                                    notifications.map((notif, idx) => (
                                                        <div key={idx} className="p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                                            <p className="text-xs font-bold text-gray-900 mb-0.5">{notif.title}</p>
                                                            <p className="text-xs text-gray-500 leading-tight">{notif.body}</p>
                                                            <p className="text-[10px] text-gray-400 mt-1">{format(notif.time, "hh:mm a")}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                )}

                {/* Drag Handle & Header */}
                {status === 'en_camino' && (
                    <div
                        onClick={toggleSheet}
                        className="w-full flex flex-col items-center pt-2.5 pb-4 px-4 shrink-0 cursor-pointer hover:bg-gray-50/50 rounded-t-[28px] transition-colors select-none"
                    >
                        <div className="w-10 h-1 bg-[#D9D9D9] rounded-full mb-3"></div>
                        <h2 className="text-[17px] font-bold text-[#FF5A0A] leading-tight text-center tracking-tight">
                            Tu técnico está en camino
                        </h2>
                        <p className="text-[12px] text-[#26292E] font-normal leading-tight mt-1 text-center">
                            Tiempo de llegada estimado: <span className="font-bold">{calculatedEta || eta || 'Calculando...'}</span>
                        </p>
                    </div>
                )}

                {/* Scrollable Content inside Sheet */}
                <div className={`flex-1 overflow-y-auto px-5 pb-32 scrollbar-hide pt-0 ${status === 'en_camino' && sheetHeight <= 30 ? 'hidden' : ''}`}>
                    {renderServiceSelector && renderServiceSelector()}

                    {/* Info Card de Visita */}
                    <div className={`border border-gray-100 rounded-[24px] p-5 mb-6 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${renderServiceSelector ? 'mt-2' : 'mt-4'}`}>
                        <div className="flex flex-col gap-3.5">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-[13px] font-normal">Día</span>
                                <span className="font-bold text-gray-900 text-[13px]">
                                    {data.fecha_programacion && parseSafeDate(data.fecha_programacion)
                                        ? toTitleCase(format(parseSafeDate(data.fecha_programacion)!, "d 'de' MMMM", { locale: es }))
                                        : 'Por definir'}
                                </span>
                            </div>

                            <div className="h-[1px] bg-[#F3F3F3] w-full" />

                            {status !== 'en_camino' && (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-[13px] font-normal">Rango</span>
                                        <span className="font-bold text-gray-900 text-[13px]">
                                            {formatTramoToRange(data.tramo)}
                                        </span>
                                    </div>
                                    <div className="h-[1px] bg-[#F3F3F3] w-full" />
                                </>
                            )}

                            <div className="flex justify-between items-start gap-4">
                                <span className="text-gray-400 text-[13px] font-normal shrink-0">Dirección</span>
                                <span className="font-bold text-gray-900 text-[13px] text-right leading-snug line-clamp-3">
                                    {formatAddress(data.direccion)}
                                </span>
                            </div>

                            {data.tipo === 'ticket' ? (
                                <div className="bg-[#F8F9FA] border border-gray-100/90 rounded-[18px] p-4 mt-1 flex flex-col">
                                    <p className="text-[11px] font-medium text-gray-500 tracking-normal mb-1">Ticket</p>
                                    <p className="text-[16px] font-black text-gray-900 tracking-tight leading-none">
                                        {data.codisegui || data.idoperacion || 'No especificado'}
                                    </p>
                                </div>
                            ) : isPostventa ? (() => {
                                const motivoPostventa = data.motivo_postventa || data.tipo_trabajo || 'Atención Postventa';
                                const parsedPlan = parsePlanData(data.campana);
                                const postventaServicios = formatPostventaServices(motivoPostventa);
                                const serviciosAMostrar = [
                                    ...postventaServicios,
                                    ...parsedPlan.svas.filter(s => !postventaServicios.some(ps => ps.toLowerCase().includes(s.toLowerCase())))
                                ].filter(Boolean);

                                return (
                                    <div className="flex flex-col w-full mt-1 pt-2">
                                        <div className="mb-3 text-left">
                                            <p className="text-[11px] font-bold text-gray-400 mb-1">Ticket</p>
                                            <p className="text-[17px] font-bold text-gray-900 tracking-tight">
                                                {data.codisegui || data.idoperacion || 'No especificado'}
                                            </p>
                                        </div>

                                        <div className="bg-[#F8F9FA] rounded-[18px] p-4 border border-gray-100/90">
                                            <p className="text-[11px] font-bold text-gray-400 mb-3">Servicio solicitado</p>
                                            <div className="flex flex-col gap-3">
                                                {serviciosAMostrar.map((sva, idx) => (
                                                    <div key={idx} className="flex items-center gap-2.5">
                                                        <div className="w-6 h-6 rounded-full bg-[#FFEFE7] flex items-center justify-center shrink-0">
                                                            <SvaServiceIcon name={sva} />
                                                        </div>
                                                        <span className="text-[13px] font-semibold text-gray-900 leading-tight">
                                                            {formatSvaName(sva)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })() : (() => {
                                const parsedPlan = parsePlanData(data.campana);
                                return (
                                    <div className="flex flex-col w-full mt-1 pt-2">
                                        {parsedPlan.paquete && (
                                            <div className="mb-3 text-left">
                                                <p className="text-[11px] font-bold text-gray-400 mb-1">Paquete de internet</p>
                                                <p className="text-[17px] font-bold text-gray-900 tracking-tight">
                                                    {toTitleCase(parsedPlan.paquete)}
                                                </p>
                                                <div className="w-full bg-[#FFEFE7] rounded-[14px] px-3.5 py-1.5 mt-2.5 flex items-center gap-2">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                                        <circle cx="12" cy="12" r="9.5" stroke="#FF5A0A" strokeWidth="1.5" />
                                                        <path d="M12 11.5V16.5" stroke="#FF5A0A" strokeWidth="1.5" strokeLinecap="round" />
                                                        <circle cx="12" cy="7.75" r="0.75" fill="#FF5A0A" />
                                                    </svg>
                                                    <span className="text-[12px] font-normal text-[#FF5A0A] leading-tight">
                                                        Velocidad de tu plan sin considerar promociones
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {parsedPlan.svas.length > 0 && (
                                            <div className="bg-[#F8F9FA] rounded-[18px] p-4 border border-gray-100/90">
                                                <p className="text-[11px] font-bold text-gray-400 mb-3">Servicios adicionales</p>
                                                <div className="flex flex-col gap-3">
                                                    {parsedPlan.svas.map((sva, idx) => (
                                                        <div key={idx} className="flex items-center gap-2.5">
                                                            <div className="w-6 h-6 rounded-full bg-[#FFEFE7] flex items-center justify-center shrink-0">
                                                                <SvaServiceIcon name={sva} />
                                                            </div>
                                                            <span className="text-[13px] font-semibold text-gray-900 leading-tight">
                                                                {formatSvaName(sva)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!parsedPlan.paquete && data.campana && (
                                            <div className="bg-[#F8F9FA] border border-gray-100/90 rounded-[18px] p-4 text-gray-900 mt-1">
                                                <p className="text-[13px] font-bold leading-snug">{toTitleCase(data.campana)}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Vertical Timeline */}
                    <div className="relative pl-[28px] border-l-[2px] border-dashed border-[#E4E7E9] ml-4 mb-8 mt-4">
                        {steps.map((step, i) => {
                            const isCompleted = i <= statusIndex;
                            return (
                                <div key={step.id} className="relative pb-8 last:pb-0">
                                    <div className="absolute -left-[39px] top-0 flex items-center justify-center">
                                        {isCompleted ? (
                                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                                <path d="M15 1.34C16.5083 2.211 17.7629 3.46 18.6398 4.965C19.5167 6.47 19.9854 8.178 19.9994 9.919C20.0135 11.661 19.5725 13.376 18.72 14.895C17.8676 16.413 16.6332 17.683 15.1392 18.578C13.6452 19.473 11.9434 19.963 10.2021 19.998C8.4608 20.033 6.7406 19.613 5.2116 18.779C3.6826 17.945 2.3979 16.726 1.4847 15.243C0.5715 13.76 0.0614 12.065 0.005 10.324L0 10L0.005 9.676C0.061 7.949 0.5635 6.266 1.4636 4.791C2.3637 3.316 3.6307 2.099 5.1409 1.26C6.6511 0.42 8.3531 -0.014 10.081 0C11.8089 0.014 13.5036 0.476 15 1.34ZM13.707 7.293C13.5348 7.121 13.3057 7.017 13.0627 7.002C12.8197 6.987 12.5794 7.061 12.387 7.21L12.293 7.293L9 10.585L7.707 9.293L7.613 9.21C7.4206 9.061 7.1804 8.987 6.9374 9.002C6.6944 9.018 6.4654 9.121 6.2933 9.293C6.1211 9.465 6.0177 9.694 6.0024 9.937C5.987 10.18 6.0609 10.42 6.21 10.613L6.293 10.707L8.293 12.707L8.387 12.79C8.5624 12.926 8.778 13 9 13C9.222 13 9.4376 12.926 9.613 12.79L9.707 12.707L13.707 8.707L13.79 8.613C13.9393 8.42 14.0132 8.18 13.9979 7.937C13.9826 7.694 13.8792 7.465 13.707 7.293Z" fill="#FF5A0A" />
                                            </svg>
                                        ) : (
                                            <div className="w-[20px] h-[20px] rounded-full bg-[#D9D9D9] flex items-center justify-center shrink-0" />
                                        )}
                                    </div>

                                    <div className="flex flex-col justify-start">
                                        <h4 className={`text-[14px] leading-tight font-bold ${isCompleted ? 'text-[#26292E]' : 'text-[#A0A2AC]'}`}>
                                            {step.label}
                                        </h4>

                                        {isCompleted && step.sub && (
                                            <p className="text-[12px] leading-tight mt-1 text-[#535C67]">
                                                {step.sub}
                                            </p>
                                        )}

                                        {step.id === 'asignado' && isCompleted && tecnico && status !== 'finalizada' && status !== 'cerrada' && (
                                            <div className="flex items-center gap-3 bg-[#F3F3F3] p-3 rounded-[10px] mt-3 -ml-1 shadow-none border-none">
                                                <div
                                                    onClick={() => {
                                                        if (tecnico.foto && !hasImageError) setIsPhotoModalOpen(true);
                                                    }}
                                                    className={`w-[44px] h-[44px] rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden ${tecnico.foto && !hasImageError ? 'cursor-pointer hover:ring-2 hover:ring-[#FF5A0A]/50 transition-all shadow-sm' : ''
                                                        }`}
                                                    title={tecnico.foto && !hasImageError ? "Ver foto del técnico" : undefined}
                                                >
                                                    {tecnico.foto && !hasImageError ? (
                                                        <img
                                                            src={tecnico.foto}
                                                            alt=""
                                                            onError={() => setHasImageError(true)}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <User className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-[#26292E] text-[13px] leading-tight mb-1 truncate">
                                                        {extractTechnicianName(tecnico.nombre, tecnico.cuadrilla)}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                                        {tecnico.dni && (
                                                            <div className="flex items-center gap-1.5 text-[#535C67]">
                                                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                                                    <path d="M1.625 3.292C1.625 2.861 1.796 2.448 2.101 2.143C2.406 1.838 2.819 1.667 3.25 1.667H9.75C10.181 1.667 10.594 1.838 10.899 2.143C11.204 2.448 11.375 2.861 11.375 3.292V8.709C11.375 9.14 11.204 9.553 10.899 9.858C10.594 10.162 10.181 10.334 9.75 10.334H3.25C2.819 10.334 2.406 10.162 2.101 9.858C1.796 9.553 1.625 9.14 1.625 8.709V3.292Z" stroke="#535C67" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M4.11 5.682C3.907 5.682 3.75 5.525 3.75 5.322C3.75 5.119 3.907 4.962 4.11 4.962H5.19C5.393 4.962 5.55 5.119 5.55 5.322C5.55 5.525 5.393 5.682 5.19 5.682H4.11ZM7.36 5.682C7.157 5.682 7 5.525 7 5.322C7 5.119 7.157 4.962 7.36 4.962H8.89C9.093 4.962 9.25 5.119 9.25 5.322C9.25 5.525 9.093 5.682 8.89 5.682H7.36Z" fill="#535C67" />
                                                                </svg>
                                                                <span className="text-[11px] font-medium text-[#535C67]">{formatMaskedDni(tecnico.dni)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                                                <path d="M4.278 2.864L1.353 3.288L1.302 3.298C1.223 3.319 1.152 3.36 1.095 3.418C1.037 3.475 0.996 3.547 0.976 3.626C0.955 3.704 0.956 3.787 0.978 3.865C1 3.943 1.042 4.014 1.1 4.07L3.218 6.132L2.719 9.045L2.713 9.095C2.708 9.176 2.725 9.257 2.762 9.33C2.798 9.402 2.854 9.464 2.922 9.508C2.99 9.552 3.069 9.577 3.15 9.58C3.231 9.584 3.312 9.566 3.384 9.528L5.999 8.153L8.608 9.528L8.654 9.549C8.73 9.579 8.812 9.588 8.892 9.576C8.973 9.563 9.048 9.53 9.111 9.478C9.175 9.427 9.223 9.36 9.251 9.284C9.28 9.207 9.288 9.125 9.274 9.045L8.774 6.132L10.893 4.07L10.929 4.031C10.98 3.968 11.014 3.893 11.026 3.813C11.038 3.732 11.03 3.651 11 3.575C10.971 3.5 10.922 3.433 10.858 3.383C10.795 3.333 10.719 3.3 10.639 3.288L7.715 2.864L6.408 0.215C6.37 0.138 6.311 0.073 6.238 0.028C6.166 -0.017 6.082 -0.041 5.996 -0.041C5.911 -0.041 5.827 -0.017 5.754 0.028C5.682 0.073 5.623 0.138 5.585 0.215L4.278 2.864Z" fill="#FFC200" />
                                                            </svg>
                                                            <span className="text-[11px] font-bold text-[#535C67]">4.9</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Action Buttons and Help Center CTA */}
                    <div className="flex flex-col items-center gap-3 pt-2 pb-6 mt-1">
                        {isVt && (status === 'programada' || status === 'asignado') && (
                            <button
                                onClick={() => {
                                    trackEvent('click_iniciar_reprogramacion', { token, estado_actual: status });
                                    setIsReprogramModalOpen(true);
                                    setReprogramStep('form');
                                }}
                                className="w-full bg-[#2B2B2B] hover:bg-[#1E1E1E] text-white h-12 rounded-full text-[14px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md cursor-pointer"
                            >
                                <CalendarDays className="w-4 h-4 text-white" />
                                <span>Reprogramar Visita</span>
                            </button>
                        )}
                        {status === 'finalizada' && !encuestaEnviada && localStorage.getItem(`encuesta_completada_${token}`) !== 'true' && !isSurveyModalOpen && (
                            <button
                                onClick={() => setIsSurveyModalOpen(true)}
                                className="w-full bg-[#FF5A0A] hover:bg-[#E04E07] text-white h-12 rounded-full text-[14px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md cursor-pointer"
                            >
                                <span>Calificar atención</span>
                            </button>
                        )}
                        <div className="w-full flex items-center justify-center py-2">
                            <button
                                type="button"
                                onClick={() => {
                                    trackEvent('click_contactar_soporte', { token });
                                    setIsHelpModalOpen(true);
                                }}
                                className="text-[14px] font-medium text-black underline underline-offset-4 tracking-tight hover:opacity-80 transition-opacity cursor-pointer text-center"
                            >
                                ¿Necesitas ayuda?
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Modales Desacoplados */}
            <HelpAssistantModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                token={token}
                data={data}
                onOpenReprogram={() => {
                    setIsReprogramModalOpen(true);
                    setReprogramStep('form');
                }}
            />
            <CancelAttentionModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
            />

            <ReprogramFlowModals
                isOpen={isReprogramModalOpen}
                token={token}
                data={data}
                reprogramStep={reprogramStep}
                setReprogramStep={setReprogramStep}
                onClose={() => {
                    setIsReprogramModalOpen(false);
                    setReprogramStep('form');
                }}
                onSuccessComplete={() => {
                    setIsReprogramModalOpen(false);
                    setReprogramStep('form');
                    setIsReprogramCompletada(true);
                }}
            />

            <TechnicianPhotoModal
                isOpen={isPhotoModalOpen}
                tecnico={tecnico}
                hasImageError={hasImageError}
                onClose={() => setIsPhotoModalOpen(false)}
                onImageError={() => setHasImageError(true)}
            />

            <SurveyBottomSheet
                isVisible={
                    status === 'finalizada' &&
                    isSurveyModalOpen &&
                    !encuestaEnviada &&
                    localStorage.getItem(`encuesta_completada_${token}`) !== 'true'
                }
                encuestaApp={encuestaApp}
                setEncuestaApp={setEncuestaApp}
                isSubmittingEncuesta={isSubmittingEncuesta}
                onClose={() => setIsSurveyModalOpen(false)}
                onSubmit={handleEncuestaSubmit}
            />
        </div>
    );
};

export default Seguimiento;