import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { getPortalTheme } from "../utils/portalThemes";
import { getNavItems } from "./navConfig";

const NOTIFICATION_LINKS = [
  ["announcements", "Announcements", "announcements"],
  ["circulars", "Circulars", "circulars"],
  ["resources", "Resources", "resources"],
  ["discussions", "Subject discussions", "resources"],
  ["direct", "Direct messages", "resources"],
  ["assignments", "Assignment updates", "tasks"],
  ["buzz", "Campus Buzz updates", "buzz"],
  ["forum", "Forum discussions", "forum"],
];

export default function GlobalHeader() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = getPortalTheme(user.role);

  const [counts, setCounts] = useState({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const dropdownRef = useRef(null);
  const refreshSequence = useRef(0);

  const navItems = useMemo(() => getNavItems(user.role), [user.role]);
  const availablePaths = useMemo(() => new Set(navItems.map((item) => item.path)), [navItems]);

  const activeNotificationLinks = useMemo(() => {
    return NOTIFICATION_LINKS.filter(([key, , path]) => availablePaths.has(path) && (counts[key] > 0));
  }, [availablePaths, counts]);

  const unreadTotal = useMemo(() => {
    return activeNotificationLinks.reduce((total, [key]) => total + (counts[key] || 0), 0);
  }, [activeNotificationLinks, counts]);

  const refreshCounts = useCallback(() => {
    const sequence = ++refreshSequence.current;
    return api.get("/notifications/unread").then((response) => {
      if (sequence === refreshSequence.current) {
        setCounts(response.data.counts || {});
        setNotificationError("");
      }
    }).catch((error) => {
      if (sequence === refreshSequence.current) setNotificationError(error.response?.data?.message || "Could not load notifications.");
    });
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, user.id, location.pathname]);

  useEffect(() => {
    if (!socket) return undefined;
    const events = ["unread:message", "unread:refresh", "resource:new", "circular:new", "task:new", "task:status", "buzz:new", "forum:new"];
    events.forEach((event) => socket.on(event, refreshCounts));
    socket.on("connect", refreshCounts);
    return () => {
      events.forEach((event) => socket.off(event, refreshCounts));
      socket.off("connect", refreshCounts);
    };
  }, [socket, refreshCounts]);

  // Click anywhere outside the notification popup to close it
  useEffect(() => {
    function handleOutsideClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showNotifications]);

  function goToProfile() {
    setShowNotifications(false);
    navigate("/app/profile");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 shadow-xs backdrop-blur-md">
      <div className="flex items-center gap-2">
        {/* Clean left section without global search */}
      </div>

      <div className="ml-auto flex items-center gap-4">
        {/* Notifications Popover with Outside Click Listener */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-label={unreadTotal ? `${unreadTotal} unread notifications` : "Notifications"}
            aria-expanded={showNotifications}
            onClick={() => {
              const shouldOpen = !showNotifications;
              setShowNotifications(shouldOpen);
              if (shouldOpen) refreshCounts();
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Bell size={20} />
            {unreadTotal > 0 && (
              <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white"></span>
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
                <p className="font-semibold text-slate-900 text-sm">Notifications</p>
                {unreadTotal > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                    {unreadTotal} new
                  </span>
                )}
              </div>
              {notificationError && <p role="alert" className="px-2 py-2 text-xs text-rose-600">{notificationError}</p>}
              <div className="mt-1 divide-y divide-slate-50 max-h-72 overflow-y-auto">
                {activeNotificationLinks.map(([key, label, path]) => (
                  <Link
                    key={key}
                    to={`/app/${path}`}
                    onClick={() => setShowNotifications(false)}
                    className="flex items-center justify-between rounded-xl px-2.5 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-slate-700 font-medium">{label}</span>
                    <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">
                      {counts[key]}
                    </span>
                  </Link>
                ))}
              </div>
              {unreadTotal === 0 && !notificationError && (
                <div className="py-6 text-center text-xs text-slate-400">
                  You&apos;re all caught up.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-7 w-px bg-slate-200" />

        {/* User Profile in Header */}
        <button type="button" onClick={goToProfile} className="flex items-center gap-3 text-right group">
          <span className="hidden sm:block">
            <span className="block max-w-56 truncate text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
              {user.name}
            </span>
            <span className="block text-xs font-medium text-slate-500">
              {user.role === "student" ? `${user.branch?.code || "Student"} · Year ${user.year || "-"}` : theme.name}
            </span>
          </span>
          <span className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm shadow-xs ${theme.avatarBg}`}>
            {user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        </button>
      </div>
    </header>
  );
}
