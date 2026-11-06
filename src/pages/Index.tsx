import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import pantallaWinEnRutaImg from "@/assets/pantalla_win_en_ruta.webp";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Si la URL contiene un token directo como query param (?token=... o ?t=...)
    const queryToken = searchParams.get("token") || searchParams.get("t");
    if (queryToken) {
      navigate(`/seguimiento/${queryToken.trim()}`);
    }
  }, [searchParams, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] w-full bg-white flex flex-col items-center justify-center p-0 m-0 select-none overflow-x-hidden"
    >
      <img
        src={pantallaWinEnRutaImg}
        alt="WIN en RUTA - Sigue tu instalación"
        className="w-full max-w-[480px] h-auto min-h-[100dvh] object-cover sm:object-contain mx-auto select-none pointer-events-none"
      />
    </motion.div>
  );
};

export default Index;
