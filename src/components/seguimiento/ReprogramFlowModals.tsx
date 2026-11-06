import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, MapPin, ChevronDown, Calendar, Clock } from "lucide-react";
import { InstalacionData } from "@/types/tracking";
import {
    normalizeDateStr,
    normalizeTramo,
    parseApiDate,
    getAvailableDaysFallback,
    formatSelectedDate
} from "@/utils/trackingFormatters";
import { API_BASE_URL } from "@/config/api";
import { trackEvent } from "@/lib/firebaseConfig";

export type ReprogramStep = 'form' | 'confirm_popup' | 'confirm_identity' | 'success';

interface ReprogramFlowModalsProps {
    isOpen: boolean;
    token?: string;
    data: InstalacionData;
    reprogramStep: ReprogramStep;
    setReprogramStep: React.Dispatch<React.SetStateAction<ReprogramStep>>;
    onClose: () => void;
    onSuccessComplete: () => void;
}

export const ReprogramFlowModals = ({
    isOpen,
    token,
    data,
    reprogramStep,
    setReprogramStep,
    onClose,
    onSuccessComplete
}: ReprogramFlowModalsProps) => {
    const [reprogramData, setReprogramData] = useState({
        fecha: '',
        turno: '',
        motivo: '',
        motivoSeleccionado: ''
    });
    const [isSubmittingReprogram, setIsSubmittingReprogram] = useState(false);
    const [cuposApi, setCuposApi] = useState<Array<{ fecha: string; disponible: boolean; tramos: Array<{ tramo: string; disponible: boolean }> }>>([]);
    const [isLoadingCupos, setIsLoadingCupos] = useState(false);
    const [cuposError, setCuposError] = useState<string | null>(null);
    const [pin, setPin] = useState<string[]>(['', '', '', '']);
    const [pinError, setPinError] = useState(false);

    const pinRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null)
    ];

    const fetchCupos = async () => {
        if (!token) return;
        setIsLoadingCupos(true);
        setCuposError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/cupos/${token}`);
            const dataRes = await res.json();
            if (dataRes.success && Array.isArray(dataRes.cupos)) {
                const now = new Date();
                const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

                const cuposDisponibles = (dataRes.cupos || []).filter((d: any) => {
                    if (!d || d.disponible !== true) return false;
                    const norm = normalizeDateStr(d.fecha);
                    if (!norm || norm < tomorrowIso) return false;
                    const hasTramos = Array.isArray(d.tramos) && d.tramos.some((t: any) => t.disponible === true);
                    return hasTramos;
                });

                const primeros7 = cuposDisponibles.slice(0, 7);
                setCuposApi(primeros7);
                const primerDisponible = primeros7[0];
                if (primerDisponible) {
                    setReprogramData(prev => {
                        const matchesExisting = primeros7.some((c: any) => normalizeDateStr(c.fecha) === normalizeDateStr(prev.fecha));
                        return {
                            ...prev,
                            fecha: matchesExisting ? prev.fecha : primerDisponible.fecha,
                            turno: ''
                        };
                    });
                }
            } else {
                setCuposError(dataRes.message || 'No se pudo obtener disponibilidad');
            }
        } catch {
            setCuposError('Error de conexión al consultar cupos');
        } finally {
            setIsLoadingCupos(false);
        }
    };

    useEffect(() => {
        if (isOpen && token) {
            fetchCupos();
        }
    }, [isOpen, token]);

    useEffect(() => {
        if (reprogramStep === 'confirm_identity') {
            const timer = setTimeout(() => {
                pinRefs[0].current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [reprogramStep]);

    const getMaskedClientPhone = () => {
        const raw = data?.cliente_telefono || data?.tecnico?.telefono || '';
        if (raw) {
            const clean = String(raw).replace(/\D/g, '');
            if (clean.length >= 6) {
                const last9 = clean.slice(-9);
                return `+51 ${last9.slice(0, 3)} *** *${last9.slice(-2)}`;
            }
        }
        return '+51 9** *** **';
    };

    const handlePinChange = (index: number, val: string) => {
        const digit = val.replace(/\D/g, '').slice(-1);
        const newPin = [...pin];
        newPin[index] = digit;
        setPin(newPin);
        setPinError(false);

        if (digit && index < 3) {
            pinRefs[index + 1].current?.focus();
        }
    };

    const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (pin[index]) {
                const newPin = [...pin];
                newPin[index] = '';
                setPin(newPin);
                setPinError(false);
            } else if (index > 0) {
                const newPin = [...pin];
                newPin[index - 1] = '';
                setPin(newPin);
                setPinError(false);
                pinRefs[index - 1].current?.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            pinRefs[index - 1].current?.focus();
        } else if (e.key === 'ArrowRight' && index < 3) {
            pinRefs[index + 1].current?.focus();
        }
    };

    const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
        if (pasted) {
            const newPin = ['', '', '', ''];
            for (let i = 0; i < pasted.length; i++) {
                newPin[i] = pasted[i];
            }
            setPin(newPin);
            setPinError(false);
            const nextIdx = Math.min(pasted.length, 3);
            pinRefs[nextIdx].current?.focus();
        }
    };

    const handleReprogramSubmit = async () => {
        setIsSubmittingReprogram(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/reprogramar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    ...reprogramData,
                    fecha: normalizeDateStr(reprogramData.fecha),
                    pin: pin.join('')
                })
            });

            const result = await response.json();

            if (result.success) {
                trackEvent('reprogramar_solicitud_completada', { token, motivo: reprogramData.motivoSeleccionado });
                localStorage.setItem(`reprogramacion_completada_${token}`, 'true');
                setReprogramStep('success');
            } else if (response.status === 409) {
                alert(result.message || "El cupo seleccionado acaba de agotarse. Por favor selecciona otro horario.");
                await fetchCupos();
                setReprogramStep('form');
            } else {
                alert(result.message || "Ocurrió un error. Por favor intenta de nuevo más tarde.");
            }
        } catch {
            alert("Error de conexión al guardar la solicitud.");
        } finally {
            setIsSubmittingReprogram(false);
        }
    };

    const handlePinSubmit = () => {
        const enteredPin = pin.join('');
        if (enteredPin.length < 4) return;

        const expectedPin = data?.pin_token ? String(data.pin_token).trim() : null;
        const isCorrect = expectedPin
            ? enteredPin === expectedPin
            : (enteredPin === '1234' || enteredPin === (data?.token_inicio || '').slice(0, 4));

        if (!isCorrect) {
            setPinError(true);
            return;
        }

        setPinError(false);
        handleReprogramSubmit();
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-0 z-[100] bg-[#F5F6F8] flex flex-col font-sans"
                    >
                        {reprogramStep === 'confirm_identity' ? (
                            <div className="flex-1 bg-white flex flex-col justify-between overflow-y-auto">
                                <div className="bg-white px-4 pt-4 pb-2 flex items-center shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setReprogramStep('confirm_popup')}
                                        className="p-1 -ml-1 text-[#FF5A0A] hover:bg-orange-50 active:bg-orange-100 rounded-full transition-colors cursor-pointer"
                                        aria-label="Volver"
                                    >
                                        <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                                    </button>
                                </div>

                                <div className="flex-1 flex flex-col items-center pt-2 pb-4 px-6 max-w-[360px] mx-auto w-full">
                                    <div className="w-[73px] h-[81px] relative flex items-center justify-center mb-6">
                                        <svg width="73" height="81" viewBox="0 0 73 81" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                            <path d="M36.5 25.5V40.5V25.5Z" fill="#FF5A0A" />
                                            <path d="M36.5 25.5V40.5" stroke="#26292E" strokeWidth="6" strokeLinecap="round" />
                                            <path d="M36.5 55.5C38.7091 55.5 40.5 53.7091 40.5 51.5C40.5 49.2909 38.7091 47.5 36.5 47.5C34.2909 47.5 32.5 49.2909 32.5 51.5C32.5 53.7091 34.2909 55.5 36.5 55.5Z" fill="#26292E" />
                                            <path d="M3.5 34.6418C3.5 22.8106 3.5 16.895 4.88424 14.9049C6.26844 12.9148 11.7805 11.0109 22.8047 7.20292L24.905 6.47746C30.6517 4.49249 33.5249 3.5 36.5 3.5C39.4751 3.5 42.3483 4.49249 48.0951 6.47746L50.1954 7.20292C61.2196 11.0109 66.7317 12.9148 68.1158 14.9049C69.5 16.895 69.5 22.8106 69.5 34.6418C69.5 36.4285 69.5 38.3666 69.5 40.4682C69.5 49.7363 66.4317 56.8851 62.1667 62.3452M4.20708 47.9C7.35095 63.8041 20.2802 71.9977 28.7947 75.751C31.44 76.9169 32.7626 77.5 36.5 77.5C40.2374 77.5 41.56 76.9169 44.2051 75.751C46.3252 74.8164 48.7188 73.6069 51.1667 72.0714" stroke="#FF5A0A" strokeWidth="7" strokeLinecap="round" />
                                        </svg>
                                    </div>

                                    <h2 className="text-[20px] font-bold text-[#1F2937] mb-2 leading-snug text-center">
                                        Confirma tu identidad
                                    </h2>
                                    <p className="text-[13px] text-[#6B7280] leading-relaxed mb-6 max-w-[290px] text-center">
                                        Ingresa el código de validación que enviamos a tu WhatsApp{' '}
                                        <span className="font-semibold text-gray-800">{getMaskedClientPhone()}</span>
                                    </p>

                                    <div className="flex items-center justify-center gap-3 w-full max-w-[280px]">
                                        {pin.map((digit, idx) => (
                                            <input
                                                key={idx}
                                                ref={pinRefs[idx]}
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handlePinChange(idx, e.target.value)}
                                                onKeyDown={(e) => handlePinKeyDown(idx, e)}
                                                onPaste={idx === 0 ? handlePinPaste : undefined}
                                                className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-[22px] font-bold rounded-[16px] border-2 transition-all bg-white text-gray-900 focus:outline-none ${pinError
                                                    ? 'border-[#FF4D4F] bg-[#FFF2F0] text-[#FF4D4F] focus:border-[#FF4D4F]'
                                                    : digit
                                                        ? 'border-gray-300 focus:border-[#FF5A0A] focus:ring-2 focus:ring-[#FF5A0A]/10'
                                                        : 'border-gray-200 focus:border-[#FF5A0A] focus:ring-2 focus:ring-[#FF5A0A]/10'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {pinError && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center justify-center gap-1.5 bg-[#FFF2F0] border border-[#FFCCC7] rounded-full py-1.5 px-3.5 mt-5 text-[12px] font-medium text-[#CF1322]"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                                                <circle cx="7" cy="7" r="6" stroke="#CF1322" strokeWidth="1.2" />
                                                <path d="M7 4.2V7.5M7 9.8H7.01" stroke="#CF1322" strokeWidth="1.3" strokeLinecap="round" />
                                            </svg>
                                            <span>El PIN no coincide Inténtalo nuevamente.</span>
                                        </motion.div>
                                    )}
                                </div>

                                <div className="p-4 w-full max-w-[360px] mx-auto shrink-0">
                                    <button
                                        type="button"
                                        disabled={pin.join('').length !== 4 || isSubmittingReprogram}
                                        onClick={handlePinSubmit}
                                        className="w-full bg-[#FF5A0A] disabled:bg-[#E4E7E9] disabled:text-[#A0A2AC] text-white font-bold h-12 rounded-full text-[14px] transition-all shadow-md disabled:shadow-none cursor-pointer disabled:cursor-not-allowed active:scale-95 disabled:active:scale-100"
                                    >
                                        {isSubmittingReprogram ? "Validando..." : "Continuar"}
                                    </button>
                                </div>
                            </div>
                        ) : reprogramStep === 'success' ? (
                            <div className="flex-1 bg-white flex flex-col justify-between overflow-y-auto">
                                <div className="bg-white px-4 pt-4 pb-2 flex items-center shrink-0">
                                    <button
                                        type="button"
                                        onClick={onSuccessComplete}
                                        className="p-1 -ml-1 text-[#FF5A0A] hover:bg-orange-50 active:bg-orange-100 rounded-full transition-colors cursor-pointer"
                                        aria-label="Volver"
                                    >
                                        <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                                    </button>
                                </div>

                                <div className="flex-1 flex flex-col items-center pt-8 pb-4 px-6 max-w-[360px] mx-auto w-full text-center">
                                    <div className="w-[84px] h-[84px] relative flex items-center justify-center mb-6">
                                        <svg width="84" height="84" viewBox="140 109 95 95" fill="none" className="shrink-0">
                                            <path
                                                d="M228.665 152.19V156.024C228.66 165.009 225.751 173.751 220.371 180.948C214.991 188.144 207.429 193.409 198.813 195.956C190.196 198.504 180.987 198.198 172.559 195.084C164.131 191.97 156.935 186.216 152.044 178.678C147.154 171.14 144.831 162.224 145.422 153.258C146.014 144.293 149.487 135.758 155.325 128.928C161.163 122.098 169.052 117.338 177.816 115.357C186.58 113.377 195.75 114.283 203.957 117.94"
                                                stroke="#FF5A0A"
                                                strokeWidth="8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            <path
                                                d="M228.667 122.667L187 164.375L174.5 151.875"
                                                stroke="#301D19"
                                                strokeWidth="8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </div>

                                    <h2 className="text-[20px] font-bold text-[#26292E] mb-2.5 leading-snug">
                                        ¡Tu nueva visita técnica ha sido confirmada!
                                    </h2>
                                    <p className="text-[13px] text-[#535C67] leading-relaxed max-w-[290px]">
                                        Recibirás un mensaje por WhatsApp con los detalles de tu visita en la fecha programada.
                                    </p>
                                </div>

                                <div className="p-4 w-full max-w-[360px] mx-auto shrink-0">
                                    <button
                                        type="button"
                                        onClick={onSuccessComplete}
                                        className="w-full bg-[#FF5A0A] text-white font-bold h-12 rounded-full text-[14px] shadow-md shadow-[#FF5A0A]/20 active:scale-95 transition-transform cursor-pointer"
                                    >
                                        Aceptar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white px-4 py-3.5 flex items-center shadow-sm z-10 shrink-0 border-b border-gray-100">
                                    <button
                                        onClick={onClose}
                                        className="p-1 -ml-1 text-[#FF5A0A] hover:bg-orange-50 rounded-full transition-colors cursor-pointer"
                                    >
                                        <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                                    </button>
                                    <h2 className="flex-1 text-center font-semibold text-[#FF5A0A] pr-7 text-[16px]">
                                        Reprogramación de visita
                                    </h2>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                                    <div className="bg-white p-4 rounded-[16px] flex items-center gap-3.5 border border-[#E4E7E9] shadow-sm">
                                        <div className="w-10 h-10 rounded-full bg-[#F3F3F3] flex items-center justify-center shrink-0">
                                            <MapPin className="w-5 h-5 text-[#141414] stroke-[2]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] text-[#535C67] font-medium mb-0.5">Dirección</p>
                                            <p className="text-[13px] font-semibold text-[#26292E] leading-snug line-clamp-2">
                                                {data.direccion ? data.direccion.split(/\|\|referencia:|\|referencia:|referencia:/i)[0].trim() : 'Cargando...'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-[22px] shadow-sm border border-[#E4E7E9]">
                                        <div className="mb-2">
                                            <h3 className="font-semibold text-[15px] text-[#26292E]">Selecciona la fecha</h3>
                                        </div>
                                        <div className="flex items-center gap-2 mb-3.5">
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
                                                <circle cx="7.5" cy="7.5" r="6.5" stroke="#FF5A0A" strokeWidth="1.2" />
                                                <path d="M7.5 4.5V7.5M7.5 10.5H7.51" stroke="#FF5A0A" strokeWidth="1.2" strokeLinecap="round" />
                                            </svg>
                                            <p className="text-[12px] text-[#FF5A0A] leading-tight font-normal">
                                                Ten en cuenta que depende de la disponibilidad de cupos.
                                            </p>
                                        </div>

                                        {isLoadingCupos ? (
                                            <div className="flex items-center justify-center p-6 text-[13px] text-gray-500 gap-2">
                                                <div className="w-4 h-4 border-2 border-[#FF5A0A] border-t-transparent rounded-full animate-spin" />
                                                <span>Consultando cupos en tiempo real...</span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-4 gap-2.5">
                                                {(cuposApi.length > 0
                                                    ? cuposApi.map((c) => ({ ...parseApiDate(c.fecha), disponible: c.disponible }))
                                                    : getAvailableDaysFallback()
                                                ).map((day) => {
                                                    const isSelected = normalizeDateStr(reprogramData.fecha) === normalizeDateStr(day.iso);
                                                    const isAvailable = day.disponible;
                                                    return (
                                                        <button
                                                            key={day.iso}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => {
                                                                if (isAvailable) {
                                                                    setReprogramData(prev => ({ ...prev, fecha: day.iso, turno: '' }));
                                                                }
                                                            }}
                                                            className={`flex flex-col items-center justify-center h-[69px] rounded-[12px] border transition-all ${!isAvailable
                                                                ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                                                                : isSelected
                                                                    ? 'border-[#FF5A0A] bg-[#FFEDE0] text-[#FF5A0A] cursor-pointer'
                                                                    : 'border-[#D9D9D9] bg-white text-[#9CA5AB] hover:border-[#FF5A0A]/40 cursor-pointer'
                                                                }`}
                                                        >
                                                            <span className={`text-[11px] ${!isAvailable ? 'text-gray-300' : isSelected ? 'text-[#FF5A0A] font-semibold' : 'text-[#9CA5AB] font-normal'}`}>
                                                                {day.headerLabel}
                                                            </span>
                                                            <span className={`text-[17px] font-bold my-0.5 ${!isAvailable ? 'text-gray-300' : isSelected ? 'text-[#FF5A0A]' : 'text-[#26292E]'}`}>
                                                                {day.dayNum}
                                                            </span>
                                                            <span className={`text-[11px] ${!isAvailable ? 'text-gray-300' : isSelected ? 'text-[#FF5A0A] font-semibold' : 'text-[#9CA5AB] font-normal'}`}>
                                                                {day.monthName}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {cuposError && <p className="text-[11px] text-amber-600 mt-2 text-center">{cuposError}</p>}
                                    </div>

                                    <div className="bg-white p-4 rounded-[22px] shadow-sm border border-[#E4E7E9]">
                                        <h3 className="font-semibold text-[15px] text-[#26292E] mb-3">Selecciona el tramo horario</h3>
                                        <div className="flex flex-col gap-2.5">
                                            {isLoadingCupos ? (
                                                <div className="flex flex-col items-center justify-center p-6 text-[13px] text-gray-500 gap-2">
                                                    <div className="w-5 h-5 border-2 border-[#FF5A0A] border-t-transparent rounded-full animate-spin" />
                                                    <span>Consultando disponibilidad de tramos...</span>
                                                </div>
                                            ) : (() => {
                                                const selectedDayCupo = cuposApi.find(c => normalizeDateStr(c.fecha) === normalizeDateStr(reprogramData.fecha));
                                                let tramosList: Array<{ tramo: string; displayTramo: string; disponible: boolean }> = [];

                                                if (selectedDayCupo && Array.isArray(selectedDayCupo.tramos) && selectedDayCupo.tramos.length > 0) {
                                                    const map = new Map<string, { rawTramo: string; disponible: boolean }>();
                                                    selectedDayCupo.tramos.forEach((item: any) => {
                                                        const display = normalizeTramo(item.tramo);
                                                        const current = map.get(display);
                                                        map.set(display, {
                                                            rawTramo: item.tramo,
                                                            disponible: current ? (current.disponible || item.disponible) : item.disponible
                                                        });
                                                    });

                                                    tramosList = Array.from(map.entries())
                                                        .filter(([_, val]) => val.disponible === true)
                                                        .map(([displayTramo]) => ({
                                                            tramo: displayTramo,
                                                            displayTramo,
                                                            disponible: true
                                                        }));
                                                }

                                                if (tramosList.length === 0) {
                                                    return (
                                                        <p className="text-[13px] text-gray-400 text-center py-4 font-normal">
                                                            No hay tramos horarios disponibles para la fecha seleccionada.
                                                        </p>
                                                    );
                                                }

                                                return tramosList.map((item) => {
                                                    const isSelected = reprogramData.turno === item.tramo;
                                                    return (
                                                        <button
                                                            key={item.tramo}
                                                            type="button"
                                                            onClick={() => setReprogramData({ ...reprogramData, turno: item.tramo })}
                                                            className={`w-full h-[46px] rounded-[14px] flex items-center justify-between px-4 font-semibold text-[13px] transition-all ${isSelected
                                                                ? 'border border-[#FF5A0A] bg-[#FFEDE0] text-[#FF5903] cursor-pointer'
                                                                : 'border border-[#D1D5DC] bg-white text-[#26292E] hover:border-[#FF5A0A]/50 cursor-pointer'
                                                                }`}
                                                        >
                                                            <span>{item.displayTramo}</span>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-[22px] shadow-sm border border-[#E4E7E9]">
                                        <h3 className="font-semibold text-[15px] text-[#26292E] mb-3">Motivo de reprogramación</h3>

                                        <div className="mb-4 relative">
                                            <select
                                                value={reprogramData.motivoSeleccionado}
                                                onChange={(e) => setReprogramData({ ...reprogramData, motivoSeleccionado: e.target.value })}
                                                className={`w-full h-[46px] rounded-[14px] px-4 pr-10 text-[13px] font-medium border appearance-none transition-all cursor-pointer focus:outline-none ${reprogramData.motivoSeleccionado
                                                    ? 'border-[#FF5A0A] bg-[#FFEDE0] text-[#FF5903]'
                                                    : 'border-[#D1D5DC] bg-white text-gray-500 hover:border-gray-400'
                                                    }`}
                                            >
                                                <option value="" disabled>Elige una opción</option>
                                                <option value="emergencia_personal">Emergencia personal / familiar</option>
                                                <option value="problemas_salud">Problemas de salud</option>
                                                <option value="viaje_inesperado">Viaje de último minuto</option>
                                                <option value="choque_horarios">Cruce de horarios con el trabajo / estudios</option>
                                                <option value="olvido">Olvidé la cita original</option>
                                                <option value="otro">Otro motivo</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                                                <ChevronDown className={`w-4 h-4 ${reprogramData.motivoSeleccionado ? 'text-[#FF5903]' : 'text-gray-400'}`} />
                                            </div>
                                        </div>

                                        <h3 className="font-semibold text-[14px] text-[#26292E] mb-2.5">Detalle adicional (Opcional)</h3>
                                        <textarea
                                            value={reprogramData.motivo}
                                            onChange={(e) => setReprogramData({ ...reprogramData, motivo: e.target.value })}
                                            className="w-full bg-[#F9F9F9] border border-[#E4E7E9] rounded-[14px] p-3 text-[13px] text-gray-800 focus:outline-none focus:border-[#FF5A0A] resize-none placeholder:text-gray-400"
                                            rows={2}
                                            placeholder="Ej: No estaré en casa, por favor venir por la tarde..."
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] shrink-0 border-t border-gray-100">
                                    <button
                                        disabled={!reprogramData.fecha || !reprogramData.turno || !reprogramData.motivoSeleccionado}
                                        onClick={() => setReprogramStep('confirm_popup')}
                                        className="w-full bg-[#FF5A0A] disabled:bg-[#E4E7E9] disabled:text-[#A0A2AC] text-white font-bold h-12 rounded-full text-[14px] transition-all shadow-md disabled:shadow-none cursor-pointer disabled:cursor-not-allowed active:scale-95 disabled:active:scale-100"
                                    >
                                        Confirmar reprogramación
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && reprogramStep === 'confirm_popup' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-[#26292E]/40 flex items-center justify-center p-4 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-[32px] p-6 w-[342px] max-w-full relative flex flex-col items-center text-center shadow-xl"
                        >
                            <div className="w-[72px] h-[72px] relative flex items-center justify-center mb-4">
                                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="shrink-0">
                                    <path d="M62 26C58.5 15.5 48 8 36 8C20.5 8 8 20.5 8 36C8 51.5 20.5 64 36 64C47.5 64 57.5 57 61.5 47" stroke="#FF5A0A" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <rect x="23" y="25" width="26" height="24" rx="4" stroke="#0F0908" strokeWidth="3" />
                                    <path d="M30 20V26M42 20V26M23 33H49" stroke="#0F0908" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                            </div>

                            <h3 className="text-[17px] font-bold text-[#26292E] leading-snug px-1 mb-2">
                                ¿Confirmas la reprogramación de tu visita técnica?
                            </h3>
                            <p className="text-[13px] text-[#535C67] leading-relaxed mb-5 px-1">
                                Tu visita técnica actual será reemplazada por la nueva fecha y horario que elegiste.
                            </p>

                            <div className="w-full bg-[#FFF9F6] rounded-[20px] p-4 flex flex-col gap-2.5 mb-6 text-left border border-[#FFD8C2]">
                                <p className="text-[11px] font-bold text-[#FF5A0A] uppercase tracking-wider mb-0.5">Nueva visita técnica</p>
                                <div className="flex items-center gap-2.5">
                                    <Calendar className="w-4 h-4 text-[#FF5A0A] shrink-0 stroke-[2]" />
                                    <p className="text-[13px] font-bold text-[#26292E] truncate">{formatSelectedDate(reprogramData.fecha)}</p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Clock className="w-4 h-4 text-[#FF5A0A] shrink-0 stroke-[2]" />
                                    <p className="text-[12px] font-medium text-[#535C67] truncate">{reprogramData.turno}</p>
                                </div>
                            </div>

                            <button
                                disabled={isSubmittingReprogram}
                                onClick={() => {
                                    setPin(['', '', '', '']);
                                    setPinError(false);
                                    setReprogramStep('confirm_identity');
                                }}
                                className="w-full bg-[#FF5A0A] text-white font-bold h-12 rounded-full text-[14px] mb-2.5 shadow-md shadow-[#FF5A0A]/20 active:scale-95 transition-transform cursor-pointer"
                            >
                                Confirmar
                            </button>
                            <button
                                disabled={isSubmittingReprogram}
                                onClick={() => setReprogramStep('form')}
                                className="w-full bg-transparent border border-[#FF5A0A] text-[#FF5A0A] font-bold h-12 rounded-full text-[14px] active:scale-95 transition-transform cursor-pointer hover:bg-orange-50"
                            >
                                Cancelar
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};