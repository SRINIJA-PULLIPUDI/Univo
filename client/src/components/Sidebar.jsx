import { NavLink, useLocation } from "react-router-dom";
import { GraduationCap, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { getNavItems, ROLE_LABEL } from "./navConfig";
import { getPortalTheme } from "../utils/portalThemes";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const [counts, setCounts] = useState({});
  const [collapsed, setCollapsed] = useState(false);
  const refreshSequence = useRef(0);
  const items = getNavItems(user.role);
  const theme = getPortalTheme(user.role);

  const refreshCounts = useCallback(() => {
    const sequence = ++refreshSequence.current;
    return api.get("/notifications/unread").then((response) => {
      if (sequence === refreshSequence.current) setCounts(response.data.counts || {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, user.id, location.pathname]);

  useEffect(() => {
    if (!socket) return;
    const events = ["unread:message", "unread:refresh", "resource:new", "circular:new", "task:new", "task:status", "buzz:new", "forum:new"];
    events.forEach((event) => socket.on(event, refreshCounts));
    socket.on("connect", refreshCounts);
    return () => {
      events.forEach((event) => socket.off(event, refreshCounts));
      socket.off("connect", refreshCounts);
    };
  }, [socket, refreshCounts]);

  function unreadFor(path) {
    if (path === "announcements") return counts.announcements || 0;
    if (path === "resources") return (counts.resources || 0) + (counts.discussions || 0) + (counts.direct || 0);
    if (path === "circulars") return counts.circulars || 0;
    if (path === "tasks") return counts.assignments || 0;
    if (path === "buzz") return counts.buzz || 0;
    if (path === "forum") return counts.forum || 0;
    return 0;
  }

  return (
    <aside
      className={`relative flex h-screen shrink-0 flex-col bg-gradient-to-b from-[#090D15] via-[#0E121B] to-[#070A10] text-slate-200 border-r border-slate-800/80 shadow-2xl shadow-black/90 transition-all duration-300 ease-in-out ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-white/[0.02] blur-xl pointer-events-none" />

      {/* Brand & Portal Header */}
      <div className="relative z-10 px-3 pt-5 pb-3">
        <div className={`flex items-center rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-lg backdrop-blur-md transition-all ${
          collapsed ? "p-2.5 justify-center flex-col gap-2" : "p-3 gap-3"
        }`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${theme.gradient} text-white shadow-md ring-1 ring-white/20 transition-all ${
              collapsed ? "h-10 w-10" : "h-11 w-11"
            }`}
          >
            <GraduationCap size={collapsed ? 20 : 22} />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-white tracking-tight truncate leading-tight">{theme.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] font-bold text-slate-300 tracking-wide uppercase">Univo Platform</p>
              </div>
            </div>
          )}

          {/* Sidebar Collapse Toggle Button */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="relative z-10 flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2 scrollbar-thin scrollbar-thumb-slate-800">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === ""}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-2.5"
              } ${
                isActive
                  ? `${theme.activePill} ring-1 ring-white/15 shadow-md`
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white hover:border-white/10 border border-transparent"
              }`
            }
          >
            <item.icon size={18} className="shrink-0 text-slate-400 group-hover:text-white transition-transform duration-200 group-hover:scale-110" />

            {!collapsed && <span className="truncate">{item.label}</span>}

            {!collapsed && item.isAi && (
              <span className="ml-auto flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500/20 to-blue-500/20 border border-sky-400/30 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-sky-300 tracking-wider">
                <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                AI
              </span>
            )}

            {unreadFor(item.path) > 0 && (
              collapsed ? (
                <span className="absolute top-1.5 right-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#0E121B]" />
              ) : (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#0E121B]">
                  {unreadFor(item.path) > 99 ? "99+" : unreadFor(item.path)}
                </span>
              )
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom User Info & Logout */}
      <div className="relative z-10 border-t border-slate-800/80 p-2.5 bg-black/40 backdrop-blur-xs">
        <div className={`mb-2 flex items-center rounded-xl bg-white/[0.03] border border-white/[0.06] ${
          collapsed ? "justify-center p-2" : "gap-2.5 p-2.5"
        }`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{user?.name || "User"}</p>
              <p className="truncate text-[10px] text-slate-400 font-medium capitalize">{ROLE_LABEL[user?.role] || user?.role}</p>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          title={collapsed ? "Sign Out" : undefined}
          className={`flex items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs font-semibold text-rose-300 transition-all hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-white cursor-pointer ${
            collapsed ? "w-full py-2" : "w-full gap-2 px-3 py-2"
          }`}
        >
          <LogOut size={15} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
