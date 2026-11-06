import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface CancelAttentionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CancelAttentionModal = ({ isOpen, onClose }: CancelAttentionModalProps) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white rounded-[20px] p-6 w-[290px] relative flex flex-col items-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5 stroke-[2]" />
                    </button>

                    <AlertTriangle className="w-12 h-12 text-[#FF5A0A] mb-4 stroke-[1.8]" />
                    <h3 className="text-[16px] font-bold text-[#0F090B] mb-2 leading-tight">¿Deseas cancelar?</h3>
                    <p className="text-[13px] text-gray-500 mb-6 font-normal leading-relaxed">
                        Si deseas cancelar tu atención por favor comunícate a nuestros canales de atención.
                    </p>
                    <div className="flex flex-col w-full gap-2.5">
                        <button
                            className="w-full bg-[#FF5A0A] text-white rounded-full h-[44px] text-[14px] font-bold shadow-[0_4px_12px_rgba(255,90,10,0.25)] active:scale-95 transition-transform"
                            onClick={() => window.open('tel:017546000')}
                        >
                            Llamar a Central
                        </button>
                        <button
                            className="w-full rounded-full h-[44px] text-[14px] font-bold text-[#0F090B] bg-[#f2f2f2] hover:bg-[#e8e7e8] active:scale-95 transition-transform"
                            onClick={onClose}
                        >
                            Volver al seguimiento
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);