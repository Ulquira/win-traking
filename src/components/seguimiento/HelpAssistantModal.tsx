import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Headset, CheckCircle2, RotateCcw, CalendarDays } from "lucide-react";
import { InstalacionData } from "@/types/tracking";
import { API_BASE_URL } from "@/config/api";
import { trackEvent } from "@/lib/firebaseConfig";

interface ChatMessage {
  sender: "bot" | "user" | "agent";
  author?: string;
  text: string;
  timestamp: string;
}

interface HelpAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  data: InstalacionData | null;
  onOpenReprogram: () => void;
}

type BotStep = "inicio" | "demora" | "horario" | "tecnico" | "live_chat" | "resuelto";

export const HelpAssistantModal: React.FC<HelpAssistantModalProps> = ({
  isOpen,
  onClose,
  token,
  data,
  onOpenReprogram,
}) => {
  const [chatId, setChatId] = useState<number | null>(null);
  const [step, setStep] = useState<BotStep>("inicio");
  const [motivo, setMotivo] = useState<string>("");
  const [estadoChat, setEstadoChat] = useState<string>("iniciado");
  const [asesorNombre, setAsesorNombre] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nombreCliente = data?.cliente_nombre?.split(" ")[0] || "Cliente";
  const isVt = data?.tipo === "ticket";
  const canReprogram = isVt && (data?.status === "programada" || data?.status === "asignado");

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  // Restaurar o inicializar sesión al abrir el modal
  useEffect(() => {
    if (!isOpen || !token) return;

    const savedChatId = sessionStorage.getItem(`win_chat_id_${token}`);
    if (savedChatId && messages.length === 0) {
      const parsedId = Number(savedChatId);
      setChatId(parsedId);
      fetch(`${API_BASE_URL}/api/chat-log/${parsedId}?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setMessages(res.data.mensajes || []);
            setEstadoChat(res.data.estado_chat);
            setAsesorNombre(res.data.asesor_nombre || null);
            if (res.data.estado_chat === "esperando_asesor" || res.data.estado_chat === "en_atencion") {
              setStep("live_chat");
            } else if (res.data.estado_chat === "resuelto") {
              setStep("resuelto");
            }
          } else {
            initBotGreeting();
          }
        })
        .catch(() => initBotGreeting());
    } else if (messages.length === 0) {
      initBotGreeting();
    }
  }, [isOpen, token]);

  // Polling cada 3 segundos cuando está en modo Live Chat
  useEffect(() => {
    if (!isOpen || !chatId || !token) return;
    if (step !== "live_chat" && estadoChat !== "esperando_asesor" && estadoChat !== "en_atencion") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat-log/${chatId}?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setEstadoChat(json.data.estado_chat);
          if (json.data.asesor_nombre) setAsesorNombre(json.data.asesor_nombre);
          if (Array.isArray(json.data.mensajes) && json.data.mensajes.length >= messages.length) {
            setMessages(json.data.mensajes);
          }
          if (json.data.estado_chat === "resuelto") {
            setStep("resuelto");
          }
        }
      } catch (err) {
        console.error("Error en polling de chat:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, chatId, token, step, estadoChat, messages.length]);

  const syncChatLog = async (
    nextMessages: ChatMessage[],
    nextEstado: string,
    nextMotivo?: string,
    ultimoPor: "cliente" | "bot" = "cliente"
  ) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chatId,
          token,
          orden_id: data?.idoperacion || null,
          codisegui: data?.codisegui || null,
          phone: data?.cliente_telefono || null,
          grupo_servicio: data?.tipo_servicio || data?.tipo || null,
          motivo: nextMotivo || motivo || null,
          estado_chat: nextEstado,
          ultimo_mensaje_por: ultimoPor,
          mensajes: nextMessages,
        }),
      });
      const json = await res.json();
      if (json.success && json.id && !chatId) {
        setChatId(json.id);
        sessionStorage.setItem(`win_chat_id_${token}`, String(json.id));
      }
    } catch (e) {
      console.error("Error sincronizando chat:", e);
    }
  };

  const initBotGreeting = () => {
    const initialMsg: ChatMessage = {
      sender: "bot",
      text: `Hola ${nombreCliente}, soy tu asistente virtual de WIN. ¿En qué te puedo ayudar hoy con tu visita?`,
      timestamp: new Date().toISOString(),
    };
    setMessages([initialMsg]);
    setStep("inicio");
    setEstadoChat("iniciado");
    syncChatLog([initialMsg], "iniciado", undefined, "bot");
  };

  const handleSelectOption = (selectedStep: BotStep, labelText: string, motivoKey: string) => {
    const userMsg: ChatMessage = {
      sender: "user",
      text: labelText,
      timestamp: new Date().toISOString(),
    };

    let botReplyText = "";
    if (selectedStep === "demora") {
      botReplyText =
        data?.status === "en_camino"
          ? `Tu técnico ya se encuentra en ruta hacia tu domicilio. El tiempo estimado de llegada es ${data?.eta || "en breves minutos"}.`
          : `Tu atención está programada para el rango ${data?.tramo || "seleccionado"}. El técnico se pondrá en contacto apenas inicie su ruta.`;
    } else if (selectedStep === "horario") {
      botReplyText = canReprogram
        ? "Puedes elegir una nueva fecha y rango horario directamente desde aquí o solicitar ayuda de un asesor."
        : "Para modificar el horario de esta orden, te podemos comunicar en línea con un asesor.";
    } else if (selectedStep === "tecnico") {
      botReplyText = data?.tecnico?.nombre
        ? `Tu técnico asignado es ${data.tecnico.nombre}. Recuerda solicitarle tu código de validación al llegar.`
        : "Estamos asignando a la cuadrilla más cercana a tu zona. Te notificaremos apenas esté en ruta.";
    }

    const botMsg: ChatMessage = {
      sender: "bot",
      text: botReplyText,
      timestamp: new Date().toISOString(),
    };

    const updated = [...messages, userMsg, botMsg];
    setMessages(updated);
    setMotivo(motivoKey);
    setStep(selectedStep);
    setEstadoChat("en_curso");
    trackEvent("chat_opcion_seleccionada", { token, motivo: motivoKey });
    syncChatLog(updated, "en_curso", motivoKey, "cliente");
  };

  const handleStartLiveChat = async () => {
    const userMsg: ChatMessage = {
      sender: "user",
      text: "Quiero hablar con un asesor en línea",
      timestamp: new Date().toISOString(),
    };
    const botWaitMsg: ChatMessage = {
      sender: "bot",
      text: "Te estamos conectando con un asesor de WIN. Escribe tu consulta aquí abajo y te responderemos en breve.",
      timestamp: new Date().toISOString(),
    };

    const updated = [...messages, userMsg, botWaitMsg];
    setMessages(updated);
    setStep("live_chat");
    setEstadoChat("esperando_asesor");
    trackEvent("chat_solicita_asesor_vivo", { token, motivo: motivo || "consulta_general" });
    await syncChatLog(updated, "esperando_asesor", motivo || "consulta_general", "cliente");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !chatId || isSending) return;

    const optimisticMsg: ChatMessage = {
      sender: "user",
      author: "Cliente",
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat-log/${chatId}/mensaje`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          sender: "user",
          text,
        }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.mensajes)) {
        setMessages(json.mensajes);
      }
    } catch (err) {
      console.error("Error enviando mensaje:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkResolved = async () => {
    const userMsg: ChatMessage = {
      sender: "user",
      text: "Todo claro, muchas gracias.",
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setStep("resuelto");
    setEstadoChat("resuelto");
    await syncChatLog(updated, "resuelto", motivo || "resuelto_bot", "cliente");
  };

  const handleResetChat = () => {
    if (token) sessionStorage.removeItem(`win_chat_id_${token}`);
    setChatId(null);
    setAsesorNombre(null);
    initBotGreeting();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-w-md h-[82dvh] sm:h-[620px] bg-[#F8F9FA] rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#FF5A0A] px-5 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                  <Headset className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold leading-tight">
                    {asesorNombre ? asesorNombre : "Soporte WIN en Línea"}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                    <span className="text-[11px] text-white/90 font-medium">
                      {estadoChat === "en_atencion"
                        ? "Asesor conectado"
                        : estadoChat === "esperando_asesor"
                        ? "Conectando con asesor..."
                        : "Asistente activo"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Historial de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, idx) => {
                const isUser = msg.sender === "user";
                const isAgent = msg.sender === "agent";
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    {isAgent && (
                      <span className="text-[11px] font-bold text-[#FF5A0A] mb-1 ml-1">
                        {msg.author || asesorNombre || "Asesor WIN"}
                      </span>
                    )}
                    <div
                      className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-xs ${
                        isUser
                          ? "bg-[#FF5A0A] text-white rounded-br-xs"
                          : isAgent
                          ? "bg-white border border-[#FFE0CC] text-gray-900 rounded-bl-xs"
                          : "bg-white border border-gray-100 text-gray-800 rounded-bl-xs"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {/* Opciones Rápidas del Bot (antes de pasar a Live Chat) */}
              {step === "inicio" && (
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() =>
                      handleSelectOption("demora", "¿Cuánto falta para que llegue el técnico?", "consulta_demora")
                    }
                    className="w-full text-left bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-[13px] font-semibold text-gray-800 transition-all cursor-pointer"
                  >
                    🕒 ¿Cuánto falta para que llegue el técnico?
                  </button>
                  <button
                    onClick={() =>
                      handleSelectOption("horario", "Necesito cambiar la fecha u horario", "cambio_horario")
                    }
                    className="w-full text-left bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-[13px] font-semibold text-gray-800 transition-all cursor-pointer"
                  >
                    📅 Necesito cambiar la fecha u horario
                  </button>
                  <button
                    onClick={() =>
                      handleSelectOption("tecnico", "Información sobre mi técnico asignado", "info_tecnico")
                    }
                    className="w-full text-left bg-white hover:bg-[#FFF6ED] border border-gray-200 hover:border-[#FF5A0A] rounded-xl px-4 py-3 text-[13px] font-semibold text-gray-800 transition-all cursor-pointer"
                  >
                    👷 Información sobre mi técnico asignado
                  </button>
                  <button
                    onClick={handleStartLiveChat}
                    className="w-full text-left bg-[#FFF6ED] hover:bg-[#FFEFE0] border border-[#FFD8BE] rounded-xl px-4 py-3 text-[13px] font-bold text-[#FF5A0A] transition-all cursor-pointer"
                  >
                    💬 Hablar con un asesor en vivo
                  </button>
                </div>
              )}

              {(step === "demora" || step === "horario" || step === "tecnico") && (
                <div className="pt-2 flex flex-col gap-2">
                  {step === "horario" && canReprogram && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenReprogram();
                      }}
                      className="w-full bg-[#26292E] hover:bg-black text-white rounded-xl px-4 py-3 text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CalendarDays className="w-4 h-4" />
                      Reprogramar visita ahora
                    </button>
                  )}
                  <button
                    onClick={handleStartLiveChat}
                    className="w-full bg-[#FF5A0A] hover:bg-[#E04E07] text-white rounded-xl px-4 py-3 text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Headset className="w-4 h-4" />
                    Chatear con un asesor en línea
                  </button>
                  <button
                    onClick={handleMarkResolved}
                    className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5 text-[13px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Ya resolví mi duda
                  </button>
                </div>
              )}

              {step === "resuelto" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-2">
                  <p className="text-[13px] font-bold text-emerald-800">
                    ¡Gracias por comunicarte con nosotros!
                  </p>
                  <button
                    onClick={handleResetChat}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#FF5A0A] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Iniciar nueva consulta
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input en vivo (Activo cuando está en modo Live Chat) */}
            {step === "live_chat" && estadoChat !== "resuelto" && (
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  className="flex-1 h-11 px-4 rounded-full bg-gray-100 text-[13.5px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF5A0A]/40"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="w-11 h-11 rounded-full bg-[#FF5A0A] hover:bg-[#E04E07] disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
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