import { useEffect, useState } from "react";
import { Megaphone, Search, Users, X } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import ChatThread from "../components/ChatThread";
import { EmptyState } from "../components/ui";
import { useChat } from "../hooks/useChat";
import { useSocket } from "../context/SocketContext";
import { getPortalTheme } from "../utils/portalThemes";

function GroupChat({ group, canPost, searchQuery }) {
  const chat = useChat({ kind: "group", id: group._id, fetchUrl: `/groups/${group._id}/messages`, readUrl: `/groups/${group._id}/read` });
  
  const displayChat = searchQuery?.trim()
    ? {
        ...chat,
        messages: chat.messages.filter(
          (m) =>
            m.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.sender?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }
    : chat;

  return (
    <ChatThread
      chat={displayChat}
      canPost={canPost}
      canReact
      showSearchToggle={false}
      placeholder={`Post an announcement to ${group.name}...`}
      readOnlyNote="Only HODs and faculty can post here. You can read and react."
    />
  );
}

export default function Announcements() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [groups, setGroups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const theme = getPortalTheme(user.role);

  useEffect(() => {
    api.get("/groups").then((r) => {
      const firstGroup = r.data.groups[0];
      setGroups(r.data.groups.map((group) => group._id === firstGroup?._id ? { ...group, unreadCount: 0 } : group));
      if (firstGroup) setActiveId(firstGroup._id);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onUnread = ({ kind, id }) => {
      if (kind !== "group" || id === activeId) return;
      setGroups((current) => current.map((group) => group._id === id
        ? { ...group, unreadCount: (group.unreadCount || 0) + 1 }
        : group));
    };
    socket.on("unread:message", onUnread);
    return () => socket.off("unread:message", onUnread);
  }, [socket, activeId]);

  function selectGroup(groupId) {
    setActiveId(groupId);
    setShowSearch(false);
    setSearchQuery("");
    setGroups((current) => current.map((group) => group._id === groupId ? { ...group, unreadCount: 0 } : group));
  }

  const active = groups.find((g) => g._id === activeId);
  const studentPortal = user.role === "student";
  const canPost = ["hod", "faculty", "operator"].includes(user.role);
  // HOD Community is HOD-only for posting even though operator can observe
  const canPostHere = active?.type === "hod_community" ? ["hod"].includes(user.role) : canPost;

  return (
    <div className="flex h-full flex-col">
      <Topbar title="Announcements" subtitle="Real-time group conversations across your branch." />
      <div className={`flex min-h-0 flex-1 p-8 ${studentPortal ? "" : "gap-6"}`}>
        {!studentPortal && <div className="w-72 shrink-0 space-y-2.5 overflow-y-auto">
          {groups.map((group) => {
            const isActive = group._id === activeId;
            return (
              <button key={group._id} onClick={() => selectGroup(group._id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 ${
                  isActive
                    ? `${theme.activePill} border-transparent shadow-md`
                    : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs"
                }`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {group.type === "hod_community" ? <Megaphone size={18} /> : <Users size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{group.name}</p>
                  <p className={`truncate text-xs ${isActive ? "text-white/80" : "text-slate-400"}`}>{group.branch?.code || "All branches"}</p>
                </div>
                {group.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">{group.unreadCount > 99 ? "99+" : group.unreadCount}</span>}
              </button>
            );
          })}
        </div>}

        <div className={`card flex min-h-0 flex-col ${studentPortal ? "mx-auto w-full max-w-6xl" : "flex-1"}`}>
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{active.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{active.branch?.name || "College-wide HOD channel"}</p>
                </div>

                <div className="flex items-center gap-2">
                  {studentPortal && groups.length > 1 && (
                    <select
                      className="input-field !w-auto !py-1 text-xs"
                      aria-label="Choose announcement group"
                      value={activeId}
                      onChange={(event) => selectGroup(event.target.value)}
                    >
                      {groups.map((group) => (
                        <option key={group._id} value={group._id}>
                          {group.name}
                          {group.branch?.code ? ` · ${group.branch.code}` : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Search Icon & Input in Top Right Corner */}
                  {showSearch ? (
                    <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-150">
                      <Search size={14} className="absolute left-2.5 text-slate-400" />
                      <input
                        autoFocus
                        className="input-field !py-1 !pl-8 !pr-7 text-xs w-44 sm:w-56"
                        placeholder="Search announcements..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowSearch(false);
                          setSearchQuery("");
                        }}
                        className="absolute right-2 text-slate-400 hover:text-slate-600"
                        title="Close search"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSearch(true)}
                      className="btn-ghost !p-2 text-slate-500 hover:text-slate-800"
                      title="Search announcements"
                      aria-label="Search announcements"
                    >
                      <Search size={17} />
                    </button>
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <GroupChat key={active._id} group={active} canPost={canPostHere} searchQuery={searchQuery} />
              </div>
            </>
          ) : (
            <EmptyState icon={Users} title="No groups yet" subtitle="Groups appear once your branch is set up." />
          )}
        </div>
      </div>
    </div>
  );
}
