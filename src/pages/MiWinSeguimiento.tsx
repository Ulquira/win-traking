import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Seguimiento from "./Seguimiento";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { VisitaItem } from "@/types/tracking";
import { getPlanDisplayName } from "@/utils/trackingFormatters";
import { API_BASE_URL } from "@/config/api";

export type { VisitaItem };

export default function MiWinSeguimiento() {
    const { dni: paramDni, token: paramToken } = useParams<{ dni?: string; token?: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const identifier =
        paramToken || paramDni || searchParams.get('token') || searchParams.get('t') || searchParams.get('dni') || '';

    const [visitas, setVisitas] = useState<VisitaItem[]>([]);
    const [selectedToken, setSelectedToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [inputDoc, setInputDoc] = useState(/^\d+$/.test(identifier) ? identifier : '');

    useEffect(() => {
        if (!identifier || identifier.length < 5) {
            setErrorMsg("No se proporcionó un enlace o documento válido.");
            setLoading(false);
            return;
        }

        let isMounted = true;
        async function fetchVisitas() {
            try {
                setLoading(true);
                let res = await fetch(`${API_BASE_URL}/api/cliente/visitas/${encodeURIComponent(identifier)}`);

                if (!res.ok && API_BASE_URL !== 'http://localhost:3001') {
                    try {
                        const localRes = await fetch(`http://localhost:3001/api/cliente/visitas/${encodeURIComponent(identifier)}`);
                        if (localRes.ok) res = localRes;
                    } catch { }
                }

                if (!res.ok) {
                    throw new Error("No se pudieron cargar las visitas.");
                }
                const data = await res.json();
                if (!isMounted) return;

                if (data.success && data.visitas && data.visitas.length > 0) {
                    setVisitas(data.visitas);
                    const priority = data.visitas.find((v: VisitaItem) => v.estado === 'en_camino') || data.visitas[0];
                    setSelectedToken(priority.token);
                } else {
                    setVisitas([]);
                    setErrorMsg("No cuentas con visitas técnicas ni instalaciones programadas.");
                }
            } catch (err: any) {
                if (!isMounted) return;
                setErrorMsg(err.message || "Error al conectar con el servidor.");
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchVisitas();
        return () => {
            isMounted = false;
        };
    }, [identifier]);

    const selectedVisita = visitas.find(v => v.token === selectedToken) || visitas[0];

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-10 h-10 text-[#FF5A0A] animate-spin mb-4" />
                <p className="text-[15px] font-bold text-[#26292E]">Consultando tus visitas programadas...</p>
                <p className="text-[13px] text-gray-400 mt-1">Por favor espera un momento</p>
            </div>
        );
    }

    const handleBuscarDoc = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = inputDoc.trim();
        if (clean.length >= 5) {
            navigate(`/miwin/${clean}`);
        }
    };

    if (errorMsg || visitas.length === 0) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center font-sans">
                <div className="w-16 h-16 rounded-full bg-[#FFF6ED] flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-[#FF5A0A]" />
                </div>
                <h2 className="text-[20px] font-bold text-[#26292E] mb-2">Consulta de Visitas Mi WIN</h2>
                <p className="text-[14px] text-gray-500 max-w-xs mb-6 leading-relaxed">
                    {errorMsg || "Ingresa tu número de documento para consultar tus visitas técnicas o instalaciones activas."}
                </p>

                <form onSubmit={handleBuscarDoc} className="w-full max-w-xs flex flex-col gap-3 mb-4">
                    <input
                        type="text"
                        value={inputDoc}
                        onChange={(e) => setInputDoc(e.target.value)}
                        placeholder="Número de DNI o RUC"
                        className="w-full h-12 px-4 rounded-xl border border-gray-300 text-center text-[15px] font-semibold text-[#26292E] focus:outline-none focus:border-[#FF5A0A]"
                    />
                    <button
                        type="submit"
                        className="w-full h-12 rounded-xl bg-[#FF5A0A] text-white text-[14px] font-bold shadow-md hover:bg-[#E04E07] transition-all cursor-pointer"
                    >
                        Consultar visitas
                    </button>
                </form>

                <button
                    onClick={() => navigate('/')}
                    className="text-gray-400 hover:text-gray-600 text-[13px] font-medium transition-colors"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    const renderServiceSelector = () => {
        if (visitas.length <= 1) return null;
        const displayLabel = getPlanDisplayName(selectedVisita);

        return (
            <div className="w-full flex justify-center mb-1 mt-1">
                <button
                    type="button"
                    onClick={() => setIsSelectorOpen(true)}
                    className="inline-flex items-center justify-between gap-2.5 bg-white hover:bg-gray-50 active:scale-98 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-full px-3.5 py-1.5 transition-all cursor-pointer max-w-full"
                >
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M10.6666 12.9163C13.0211 13.3792 14.6666 14.4365 14.6666 15.6667C14.6666 17.3235 11.6818 18.6667 7.99992 18.6667C4.31802 18.6667 1.33325 17.3235 1.33325 15.6667C1.33325 14.4365 2.97871 13.3792 5.33325 12.9163M7.99992 15.3333V10M7.99992 10C9.10449 10 9.99992 9.10457 9.99992 8C9.99992 6.89543 9.10449 6 7.99992 6C6.89535 6 5.99992 6.89543 5.99992 8C5.99992 9.10457 6.89535 10 7.99992 10Z"
                                stroke="#FF5A0A"
                                strokeWidth="1.33333"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    <span className="text-[13px] font-bold text-[#26292E] tracking-tight truncate max-w-[230px]">
                        {displayLabel}
                    </span>
                    <div className="shrink-0 pl-1 flex items-center justify-center">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="#26292E" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </button>
            </div>
        );
    };

    return (
        <div className="relative min-h-screen w-full bg-[#F4F5F7] overflow-x-hidden">
            {selectedToken && (
                <div key={selectedToken} className="w-full">
                    <Seguimiento
                        customToken={selectedToken}
                        renderServiceSelector={renderServiceSelector}
                    />
                </div>
            )}

            <AnimatePresence>
                {isSelectorOpen && (
                    <div className="fixed inset-0 z-50 flex flex-col justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSelectorOpen(false)}
                            className="absolute inset-0 bg-[#26292E]/40 backdrop-blur-[2px]"
                        />

                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            className="relative w-full max-w-md mx-auto bg-white rounded-t-[28px] shadow-2xl overflow-hidden pb-8 z-10"
                        >
                            <div className="w-full flex items-center justify-center pt-3 pb-2">
                                <div className="w-10 h-1 bg-[#E2E2E2] rounded-full" />
                            </div>

                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                                <h3 className="text-[16px] font-bold text-[#26292E] tracking-tight">
                                    Selecciona un servicio
                                </h3>
                                <button
                                    onClick={() => setIsSelectorOpen(false)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M11 3L3 11M3 3L11 11" stroke="#26292E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex flex-col px-3 py-2 max-h-[60vh] overflow-y-auto">
                                {visitas.map((v, idx) => {
                                    const isSelected = v.token === selectedToken;
                                    const itemTitle = getPlanDisplayName(v);

                                    return (
                                        <div key={v.token}>
                                            <div
                                                onClick={() => {
                                                    setSelectedToken(v.token);
                                                    setIsSelectorOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between p-3.5 rounded-[18px] cursor-pointer transition-all ${isSelected ? 'bg-[#FFF9F5]' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3 min-w-0 pr-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'bg-[#FFEFE7]' : 'bg-gray-100'
                                                        }`}>
                                                        <svg width="15" height="15" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path
                                                                d="M10.6666 12.9163C13.0211 13.3792 14.6666 14.4365 14.6666 15.6667C14.6666 17.3235 11.6818 18.6667 7.99992 18.6667C4.31802 18.6667 1.33325 17.3235 1.33325 15.6667C1.33325 14.4365 2.97871 13.3792 5.33325 12.9163M7.99992 15.3333V10M7.99992 10C9.10449 10 9.99992 9.10457 9.99992 8C9.99992 6.89543 9.10449 6 7.99992 6C6.89535 6 5.99992 6.89543 5.99992 8C5.99992 9.10457 6.89535 10 7.99992 10Z"
                                                                stroke={isSelected ? "#FF5A0A" : "#616E79"}
                                                                strokeWidth="1.33333"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    </div>

                                                    <div className="flex flex-col text-left min-w-0">
                                                        <span className="text-[14px] font-bold text-[#26292E] leading-snug truncate">
                                                            {itemTitle}
                                                        </span>
                                                        <span className="text-[12px] text-gray-500 leading-snug mt-0.5 line-clamp-2">
                                                            {v.direccion}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="shrink-0 flex items-center justify-center pl-2">
                                                    {isSelected ? (
                                                        <div className="w-[23px] h-[23px] rounded-full border border-[#FF5A0A] bg-[#FFF6ED] flex items-center justify-center">
                                                            <div className="w-[10px] h-[10px] rounded-full bg-[#FF5A0A]" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-[23px] h-[23px] rounded-full border border-[#616E79] bg-white" />
                                                    )}
                                                </div>
                                            </div>

                                            {idx < visitas.length - 1 && (
                                                <div className="h-[1px] bg-[#141414]/5 mx-3 my-1" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}