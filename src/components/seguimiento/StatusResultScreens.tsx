import { motion } from "framer-motion";
import { CierreMascotsIllustration } from "@/components/CierreMascotsIllustration";
import { trackEvent } from "@/lib/firebaseConfig";

export const SurveyCompletedScreen = () => (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col items-center justify-center font-sans px-6 py-12 relative overflow-hidden">
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="w-full max-w-[340px] flex flex-col items-center text-center my-auto"
        >
            <div className="mb-6 flex items-center justify-center">
                <CierreMascotsIllustration className="w-[240px] h-[200px]" />
            </div>
            <h1 className="text-[22px] font-bold text-[#26292E] mb-3 leading-tight tracking-tight">
                ¡Gracias por tu opinión!
            </h1>
            <p className="text-[14px] text-[#26292E] leading-relaxed max-w-[270px] font-normal mx-auto">
                Agradecemos tu tiempo. Seguiremos trabajando para ofrecerte la mejor experiencia en casa.
            </p>
        </motion.div>
    </div>
);

export const ReprogramCompletedScreen = () => (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col font-sans justify-between items-center p-6">
        <div className="flex-1 flex flex-col items-center justify-center max-w-[360px] mx-auto w-full text-center my-auto">
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
        <div className="w-32 h-1 bg-[#141414] rounded-full mx-auto mt-4 shrink-0" />
    </div>
);

export const ClosedVisitScreen = ({ tipo, token }: { tipo?: string; token?: string }) => {
    const isVt = tipo === 'ticket';
    const wspNumber = isVt ? '51922863186' : '51923229369';
    const msg = encodeURIComponent(
        isVt ? "Hola, necesito soporte sobre mi Visita Cancelada." : "Hola, necesito soporte sobre mi visita cancelada."
    );

    return (
        <div className="min-h-[100dvh] w-full bg-white flex flex-col justify-between font-sans overflow-y-auto">
            <div className="flex-1 flex flex-col items-center justify-center pt-10 pb-6 px-6 max-w-[360px] mx-auto w-full text-center">
                <div className="w-[176px] h-[177px] mb-8 relative flex items-center justify-center">
                    <img
                        src="/visita_cancelada_mascot.png"
                        alt="Visita Cancelada"
                        className="w-full h-full object-contain pointer-events-none"
                    />
                </div>
                <h1 className="text-[22px] font-bold text-[#26292E] mb-2.5 leading-snug">
                    Visita Cancelada
                </h1>
                <p className="text-[14px] text-[#535C67] leading-relaxed max-w-[285px] mx-auto font-normal">
                    Si no reconoces esta cancelación, comunícate con nosotros para ayudarte.
                </p>
            </div>
            <div className="p-4 w-full max-w-[360px] mx-auto shrink-0 mb-4">
                <button
                    type="button"
                    onClick={() => {
                        trackEvent('click_contactar_soporte_cerrada', { token });
                        window.open(`https://wa.me/${wspNumber}?text=${msg}`);
                    }}
                    className="w-full bg-[#FF5A0A] hover:bg-[#E04E07] text-white font-bold h-12 rounded-full text-[14px] shadow-md shadow-[#FF5A0A]/20 active:scale-95 transition-transform cursor-pointer"
                >
                    Ir a WhatsApp
                </button>
            </div>
        </div>
    );
};