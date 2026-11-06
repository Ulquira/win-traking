import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Check } from "lucide-react";
import { EncuestaAppState } from "@/types/tracking";

interface SurveyBottomSheetProps {
    isVisible: boolean;
    encuestaApp: EncuestaAppState;
    setEncuestaApp: React.Dispatch<React.SetStateAction<EncuestaAppState>>;
    isSubmittingEncuesta: boolean;
    onClose: () => void;
    onSubmit: () => void;
}

export const SurveyBottomSheet = ({
    isVisible,
    encuestaApp,
    setEncuestaApp,
    isSubmittingEncuesta,
    onClose,
    onSubmit
}: SurveyBottomSheetProps) => (
    <AnimatePresence>
        {isVisible && (
            <div className="fixed inset-0 z-[95] flex items-end justify-center pointer-events-none">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-[#26292E]/30 backdrop-blur-xs pointer-events-auto"
                />

                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 260 }}
                    className="relative z-10 w-full max-w-md bg-white rounded-t-[32px] p-5 shadow-2xl border-t border-gray-100 max-h-[85vh] overflow-y-auto pointer-events-auto"
                >
                    <div className="w-10 h-1 rounded-full bg-[#D9D9D9] mx-auto mb-4" />

                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[17px] font-bold text-[#26292E] leading-tight">
                            Cuéntanos sobre tu experiencia
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full transition-colors cursor-pointer"
                            aria-label="Cerrar"
                        >
                            <X className="w-5 h-5 stroke-[2]" />
                        </button>
                    </div>

                    <div className="space-y-5 pt-1">
                        <div>
                            <p className="text-[14px] font-bold text-[#26292E] mb-2 leading-snug">
                                1. ¿Qué tan satisfecho(a) estás con la atención recibida?
                            </p>
                            <div className="flex items-center justify-center gap-2 py-1">
                                {[1, 2, 3, 4, 5].map((star) => {
                                    const isFilled = star <= encuestaApp.satisfaccion_atencion;
                                    return (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setEncuestaApp(prev => ({ ...prev, satisfaccion_atencion: star }))}
                                            className="p-1.5 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                                        >
                                            <Star className={`w-8 h-8 transition-colors ${isFilled ? 'text-[#FFC200] fill-[#FFC200]' : 'text-[#D9D9D9] fill-[#D9D9D9]'
                                                }`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-[14px] font-bold text-[#26292E] mb-2 leading-snug">
                                2. ¿Qué tan fácil fue para ti usar WIN EN RUTA para ver el estado de tu servicio?
                            </p>
                            <div className="flex items-center justify-center gap-2 py-1">
                                {[1, 2, 3, 4, 5].map((star) => {
                                    const isFilled = star <= encuestaApp.facilidad_uso;
                                    return (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setEncuestaApp(prev => ({ ...prev, facilidad_uso: star }))}
                                            className="p-1.5 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                                        >
                                            <Star className={`w-8 h-8 transition-colors ${isFilled ? 'text-[#FFC200] fill-[#FFC200]' : 'text-[#D9D9D9] fill-[#D9D9D9]'
                                                }`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-[14px] font-bold text-[#26292E] mb-2 leading-snug">
                                3. ¿Qué tan satisfecho/a estás con tu experiencia usando WIN EN RUTA?
                            </p>
                            <div className="flex items-center justify-center gap-2 py-1">
                                {[1, 2, 3, 4, 5].map((star) => {
                                    const isFilled = star <= encuestaApp.satisfaccion_experiencia;
                                    return (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setEncuestaApp(prev => ({ ...prev, satisfaccion_experiencia: star }))}
                                            className="p-1.5 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                                        >
                                            <Star className={`w-8 h-8 transition-colors ${isFilled ? 'text-[#FFC200] fill-[#FFC200]' : 'text-[#D9D9D9] fill-[#D9D9D9]'
                                                }`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-[14px] font-bold text-[#26292E] mb-2 leading-snug">
                                4. Conocer la ruta y los datos de tu técnico antes de su llegada, ¿te hizo sentir más seguro/a en casa?
                            </p>
                            <div className="flex flex-col gap-2 pt-1">
                                {['Sí, me dio seguridad', 'No hizo diferencia'].map((opcion) => {
                                    const selected = encuestaApp.seguridad_datos_tecnico === opcion;
                                    return (
                                        <button
                                            key={opcion}
                                            type="button"
                                            onClick={() => setEncuestaApp(prev => ({ ...prev, seguridad_datos_tecnico: opcion }))}
                                            className={`w-full min-h-[46px] px-4 py-2.5 rounded-[14px] flex items-center justify-start text-left gap-3 font-semibold text-[13px] border transition-all cursor-pointer ${selected
                                                    ? 'bg-[#FFEDE0] border-[#FF5A0A] text-[#FF5A0A]'
                                                    : 'bg-[#F9FAFC] border-gray-200 text-[#26292E] hover:border-gray-300'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center border ${selected ? 'border-[#FF5A0A] bg-[#FF5A0A]' : 'border-gray-300 bg-white'
                                                }`}>
                                                {selected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                            </div>
                                            <span>{opcion}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                disabled={
                                    !encuestaApp.satisfaccion_atencion ||
                                    !encuestaApp.facilidad_uso ||
                                    !encuestaApp.satisfaccion_experiencia ||
                                    !encuestaApp.seguridad_datos_tecnico ||
                                    isSubmittingEncuesta
                                }
                                onClick={onSubmit}
                                className="w-full bg-[#FF5A0A] disabled:bg-[#E4E7E9] disabled:text-[#A0A2AC] text-white font-bold h-12 rounded-full text-[14px] transition-all shadow-md disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmittingEncuesta ? "Enviando..." : "Enviar"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);