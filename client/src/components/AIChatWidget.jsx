import { useNavigate, useLocation } from "react-router-dom";
import { Bot, Sparkles, MessageSquare } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AIChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already on the full-page AI Chat page, hide the floating trigger button
  if (location.pathname.startsWith("/app/ai-chat")) {
    return null;
  }

  function handleClick() {
    navigate("/app/ai-chat");
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 group">
      {/* Hover Information Tooltip */}
      <div className="absolute right-16 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#091D33]/95 text-sky-200 text-xs font-bold whitespace-nowrap shadow-xl border border-sky-400/30 backdrop-blur-md pointer-events-none transition-all animate-in fade-in slide-in-from-right-2 duration-150">
        <Sparkles size={13} className="text-amber-300 animate-pulse" />
        <span>Ask Univo AI (Academic Assistant)</span>
        <span className="text-[10px] text-sky-400/80 px-1 py-0.5 rounded bg-white/10 font-normal">
          Full Page
        </span>
      </div>

      {/* Ambient Pulsing Aura */}
      <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-400 opacity-60 blur-xs animate-pulse group-hover:opacity-95 transition-opacity" />

      {/* Floating Action Button */}
      <button
        onClick={handleClick}
        aria-label="Open Univo AI Assistant"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#081B33] via-[#0E2C52] to-[#0284C7] text-white shadow-2xl shadow-sky-950/60 border-2 border-sky-300/50 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <div className="relative flex items-center justify-center">
          <Bot
            size={26}
            className="text-white drop-shadow-md group-hover:scale-110 transition-transform duration-200"
          />
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-300 text-[#081B33] shadow-xs ring-2 ring-[#081B33]">
            <Sparkles size={10} className="stroke-[3]" />
          </span>
        </div>
      </button>
    </div>
  );
}
