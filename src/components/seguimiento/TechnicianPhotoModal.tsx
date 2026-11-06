import { motion, AnimatePresence } from "framer-motion";
import { X, IdCard, Star } from "lucide-react";
import { TecnicoData } from "@/types/tracking";
import { extractTechnicianName, formatMaskedDni } from "@/utils/trackingFormatters";

interface TechnicianPhotoModalProps {
    isOpen: boolean;
    tecnico?: TecnicoData;
    hasImageError: boolean;
    onClose: () => void;
    onImageError: () => void;
}

export const TechnicianPhotoModal = ({
    isOpen,
    tecnico,
    hasImageError,
    onClose,
    onImageError
}: TechnicianPhotoModalProps) => (
    <AnimatePresence>
        {isOpen && tecnico?.foto && !hasImageError && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[130] bg-black/75 flex items-center justify-center p-4 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 15 }}
                    transition={{ type: "spring", damping: 25, stiffness: 320 }}
                    className="relative bg-white rounded-[28px] p-6 max-w-[320px] w-full shadow-2xl flex flex-col items-center text-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>

                    <div className="w-44 h-44 rounded-full p-1.5 border-[3.5px] border-[#FF5A0A] shadow-xl overflow-hidden mb-4 bg-gray-100 flex items-center justify-center">
                        <img
                            src={tecnico.foto}
                            alt=""
                            onError={() => {
                                onImageError();
                                onClose();
                            }}
                            className="w-full h-full object-cover rounded-full"
                        />
                    </div>

                    <h3 className="text-[16px] font-bold text-gray-900 leading-tight mb-1 px-2">
                        {extractTechnicianName(tecnico.nombre, tecnico.cuadrilla)}
                    </h3>

                    <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                        {tecnico.dni && (
                            <>
                                <div className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                                    <IdCard className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-[12px] font-medium text-gray-700">{formatMaskedDni(tecnico.dni)}</span>
                                </div>
                                <span className="text-[11px] text-gray-300">•</span>
                            </>
                        )}
                        <div className="flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 text-primary">
                            <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                            <span className="text-[12px] font-bold text-gray-700">4.9</span>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);