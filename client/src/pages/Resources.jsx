import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Search, User } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import Topbar from "../components/Topbar";
import { EmptyState } from "../components/ui";
import { getPortalTheme } from "../utils/portalThemes";

export default function Resources() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const theme = getPortalTheme(user.role);

  useEffect(() => {
    async function load() {
      if (user.role === "student" || user.role === "coordinator") {
        const r = await api.get("/subjects/student").catch(() => ({ data: { subjects: [] } }));
        setSubjects(r.data.subjects.map((s) => ({ ...s, teacher: s.faculty?.name })));
      } else if (["faculty", "hod"].includes(user.role)) {
        const r = await api.get("/subjects/mine");
        const seen = {};
        r.data.assignments.forEach((a) => {
          const id = a.subject._id;
          seen[id] = seen[id] || { ...a.subject, sections: [] };
          seen[id].sections.push(a.section);
        });
        setSubjects(Object.values(seen));
      } else {
        const r = await api.get("/subjects");
        setSubjects(r.data.subjects);
      }
      setLoading(false);
    }
    load();
  }, [user.role]);

  useEffect(() => {
    if (!socket) return;
    const onResource = ({ subjectId }) => {
      setSubjects((current) => current.map((subject) => String(subject._id) === String(subjectId)
        ? { ...subject, unreadResourceCount: (subject.unreadResourceCount || 0) + 1 }
        : subject));
    };
    const onUnread = ({ kind, subjectId, id }) => {
      const targetId = subjectId || (kind === "subject" ? id : null);
      if (targetId) {
        setSubjects((current) => current.map((subject) => String(subject._id) === String(targetId)
          ? { ...subject, unreadResourceCount: (subject.unreadResourceCount || 0) + 1 }
          : subject));
      }
    };
    socket.on("resource:new", onResource);
    socket.on("unread:message", onUnread);
    return () => {
      socket.off("resource:new", onResource);
      socket.off("unread:message", onUnread);
    };
  }, [socket]);

  const shown = subjects.filter((subject) => `${subject.name} ${subject.code} ${subject.teacher || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <Topbar title="Resources" subtitle="Notes, records, assignments and question banks by subject." />
      <div className="p-8">
        <label className="relative mb-5 block max-w-lg">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subjects or faculty" />
        </label>
        {!loading && subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects yet" subtitle="Subjects appear once your HOD sets them up." />
        ) : !loading && shown.length === 0 ? (
          <EmptyState icon={Search} title="No matching subjects" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <Link key={s._id} to={s._id} className="card card-hover transition-all">
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr ${theme.gradient} text-white shadow-md`}>
                  <BookOpen size={20} />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{s.name}</h3>
                  {s.unreadResourceCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">{s.unreadResourceCount > 99 ? "99+" : s.unreadResourceCount}</span>}
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  {s.code} · Year {s.year} · Sem {s.semester}
                </p>
                {s.teacher && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-slate-600"><User size={14} className="text-slate-400" /> {s.teacher}</p>
                )}
                {s.sections && <p className="mt-3 text-sm font-medium text-slate-600">Sections: {s.sections.join(", ")}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
