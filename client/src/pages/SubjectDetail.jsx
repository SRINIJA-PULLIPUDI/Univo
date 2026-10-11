import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Bookmark, BookmarkCheck, Upload, Download, ExternalLink, Search, Trash2, Eye } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import ChatThread from "../components/ChatThread";
import { EmptyState, Modal, FileDrop } from "../components/ui";
import { useChat } from "../hooks/useChat";
import { useSocket } from "../context/SocketContext";
import { downloadUpload, openUpload } from "../utils/uploadUrls";
import { getPortalTheme } from "../utils/portalThemes";

import BookmarkFolderModal from "../components/BookmarkFolderModal";

const TYPES = [
  "Lecture Notes",
  "Records",
  "Assignments",
  "Mid Exam Important Questions",
  "Internal/External Important Questions",
];

function Materials({ subjectId, canUpload, canBookmark, unreadCounts, onTypeRead }) {
  const { user } = useAuth();
  const theme = getPortalTheme(user?.role);
  const { socket } = useSocket();
  const [type, setType] = useState(TYPES[0]);
  const [items, setItems] = useState([]);
  const [bookmarkMap, setBookmarkMap] = useState({});
  const [activeBookmarkModal, setActiveBookmarkModal] = useState(null); // { id, title, isBookmarked, folder, isBatch, ids }
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const shown = items.filter((resource) =>
    `${resource.title} ${resource.fileName} ${resource.uploadedBy?.name || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );

  const load = useCallback(async () => {
    const response = await api.get(`/subjects/${subjectId}/resources`, { params: { type } });
    setItems(response.data.resources);
    const unread = response.data.resources.filter((resource) => resource.isUnread);
    if (unread.length) await Promise.all(unread.map((resource) => api.post(`/resources/${resource._id}/read`)));
    onTypeRead(type);
  }, [subjectId, type, onTypeRead]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onResource = ({ subjectId: newResourceSubjectId, type: resourceType }) => {
      if (newResourceSubjectId === subjectId && resourceType === type) load();
    };
    socket.on("resource:new", onResource);
    return () => socket.off("resource:new", onResource);
  }, [socket, subjectId, type, load]);

  const loadBookmarks = useCallback(() => {
    if (!canBookmark) return;
    api.get("/bookmarks").then((r) => {
      const map = {};
      (r.data.bookmarks || []).forEach((b) => {
        if (b.resource?._id) {
          map[b.resource._id] = { id: b._id, folder: b.folder || "General" };
        }
      });
      setBookmarkMap(map);
    });
  }, [canBookmark]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  function toggleSelectResource(id) {
    setSelectedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (shown.length > 0 && selectedResourceIds.length === shown.length) {
      setSelectedResourceIds([]);
    } else {
      setSelectedResourceIds(shown.map((r) => r._id));
    }
  }

  async function handleSaveBookmark(folders) {
    if (!activeBookmarkModal) return;
    const folderList = Array.isArray(folders) ? folders : [folders || "General"];
    if (activeBookmarkModal.isBatch) {
      await api.post("/bookmarks/batch", { resourceIds: activeBookmarkModal.ids, folders: folderList });
      setSelectedResourceIds([]);
    } else {
      await api.post("/bookmarks", { resourceId: activeBookmarkModal.id, folders: folderList, type: "resource" });
    }
    loadBookmarks();
  }

  async function handleRemoveBookmark() {
    if (!activeBookmarkModal) return;
    await api.delete(`/bookmarks/${activeBookmarkModal.id}`, { data: { type: "resource" } });
    loadBookmarks();
  }

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("title", title); fd.append("type", type);
    try {
      await api.post(`/subjects/${subjectId}/resources`, fd);
      setShowUpload(false); setTitle(""); setFile(null); load();
    } finally { setBusy(false); }
  }

  async function removeResource(resource, e) {
    e?.stopPropagation();
    if (!confirm(`Delete "${resource.title}"?`)) return;
    await api.delete(`/resources/${resource._id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Attractive rounded-xl pill buttons */}
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const isSelected = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); onTypeRead(t); }}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 border ${
                  isSelected
                    ? `${theme.activePill} border-transparent shadow-xs`
                    : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                }`}
              >
                <span className="flex items-center gap-2">
                  {t}
                  {unreadCounts?.[t] > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                      {unreadCounts[t] > 99 ? "99+" : unreadCounts[t]}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {canUpload && (
          <button className="btn-primary" onClick={() => setShowUpload(true)}>
            <Upload size={16} /> Upload to "{type}"
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative block max-w-lg flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field !pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${type.toLowerCase()}`}
          />
        </label>

        {canBookmark && shown.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={shown.length > 0 && selectedResourceIds.length === shown.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
              />
              <span>Select All</span>
            </button>

            {selectedResourceIds.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setActiveBookmarkModal({
                    isBatch: true,
                    ids: selectedResourceIds,
                    title: `${selectedResourceIds.length} Resources in ${type}`,
                    folder: "General",
                  })
                }
                className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Bookmark size={14} /> Add {selectedResourceIds.length} to Bookmarks
              </button>
            )}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={FileText} title={`No ${type.toLowerCase()} yet`} />
      ) : shown.length === 0 ? (
        <EmptyState icon={Search} title="No matching resources" />
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => (
            <div
              key={r._id}
              onClick={() => {
                void openUpload(r.fileUrl, r.fileName).catch((error) =>
                  window.alert(error.response?.data?.message || error.message || "Could not open this file.")
                );
              }}
              className="card card-hover group flex items-center gap-4 !p-4 cursor-pointer transition-all duration-150 hover:border-slate-300 hover:shadow-md"
            >
              {canBookmark && (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedResourceIds.includes(r._id)}
                    onChange={() => toggleSelectResource(r._id)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                </div>
              )}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-violet-100 group-hover:text-violet-700 transition-colors">
                <FileText size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-900 group-hover:text-primary transition-colors text-sm">
                  {r.title}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {r.uploadedBy?.name} · {r.fileName}
                </p>
              </div>

              {/* Action Buttons: Bookmarks and Download */}
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                {canBookmark && (
                  <button
                    type="button"
                    onClick={() => {
                      const isBookmarked = Boolean(bookmarkMap[r._id]);
                      setActiveBookmarkModal({
                        id: r._id,
                        title: r.title,
                        isBookmarked,
                        folder: bookmarkMap[r._id]?.folder || "General",
                      });
                    }}
                    className="btn-ghost"
                    title={bookmarkMap[r._id] ? `Bookmarked in ${bookmarkMap[r._id].folder}` : "Add to bookmarks"}
                  >
                    {bookmarkMap[r._id] ? (
                      <BookmarkCheck size={18} className="text-violet-600" />
                    ) : (
                      <Bookmark size={18} />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void openUpload(r.fileUrl, r.fileName).catch((error) =>
                      window.alert(error.response?.data?.message || error.message || "Could not open this file.")
                    );
                  }}
                  className="btn-secondary !py-1.5 !px-3 !text-xs font-semibold flex items-center gap-1.5"
                  aria-label={`Preview ${r.title}`}
                  title="Preview"
                >
                  <Eye size={14} /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void downloadUpload(r.fileUrl, r.fileName).catch((error) =>
                      window.alert(error.response?.data?.message || "Could not download this file.")
                    );
                  }}
                  className="btn-secondary !py-1.5 !px-3 !text-xs font-semibold flex items-center gap-1.5"
                  aria-label={`Download ${r.title}`}
                  title="Download"
                >
                  <Download size={14} /> Download
                </button>
                {r.uploadedBy?._id === user.id && (
                  <button
                    type="button"
                    onClick={(e) => removeResource(r, e)}
                    className="btn-ghost !text-rose-600 hover:!bg-rose-50 !p-2"
                    aria-label={`Delete ${r.title}`}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bookmark Folder Selector Modal */}
      {activeBookmarkModal && (
        <BookmarkFolderModal
          isOpen={Boolean(activeBookmarkModal)}
          onClose={() => setActiveBookmarkModal(null)}
          itemTitle={activeBookmarkModal.title}
          initialFolder={activeBookmarkModal.folder}
          isBookmarked={activeBookmarkModal.isBookmarked}
          onSave={handleSaveBookmark}
          onRemove={activeBookmarkModal.isBookmarked ? handleRemoveBookmark : null}
        />
      )}

      {showUpload && (
        <Modal title={`Upload: ${type}`} onClose={() => setShowUpload(false)}>
          <form onSubmit={upload} className="space-y-4">
            <input className="input-field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <FileDrop file={file} setFile={setFile} label="Choose a file (PDF, Word, PPTX, Excel, and images are indexed for AI)" />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="btn-primary" disabled={busy || !file}>{busy ? "Uploading..." : "Upload"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Community({ subjectId }) {
  const chat = useChat({ kind: "subject", id: subjectId, fetchUrl: `/subjects/${subjectId}/discussion`, readUrl: `/subjects/${subjectId}/discussion/read` });
  return (
    <div className="card h-[32rem]">
      <ChatThread
        chat={chat}
        canReact
        canReply
        headerTitle="Community Discussion"
        headerSubtitle="Ask doubts and share solutions with your class and lecturer"
        placeholder="Ask a doubt - everyone in this subject can see and answer..."
      />
    </div>
  );
}

function DirectChat({ subjectId, studentId, facultyId, studentName }) {
  const room = `direct-${subjectId}-${studentId}-${facultyId}`;
  const chat = useChat({ kind: "direct", id: room, fetchUrl: `/subjects/${subjectId}/chat/${studentId}`, readUrl: `/subjects/${subjectId}/chat/${studentId}/read` });
  return (
    <div className="card h-[32rem]">
      <ChatThread
        chat={chat}
        canReact={true}
        canReply={true}
        headerTitle={studentName}
        headerSubtitle="Private direct conversation"
        placeholder="Message privately..."
      />
    </div>
  );
}

function Lecturer({ subject, user }) {
  const theme = getPortalTheme(user?.role);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const { socket } = useSocket();
  const isStudent = user.role === "student" || user.role === "coordinator";

  function loadStudents() {
    api.get(`/subjects/${subject._id}/students`).then((r) => setStudents(r.data.students));
  }

  useEffect(() => {
    if (!isStudent) loadStudents();
  }, [subject._id, isStudent]);

  useEffect(() => {
    if (isStudent || !socket) return;
    const onUnread = ({ kind, id, subjectId }) => {
      if (kind !== "direct" || subjectId !== subject._id) return;
      if (selected && id === `direct-${subject._id}-${selected._id}-${user.id}`) {
        setStudents((current) => current.map((student) => student._id === selected._id ? { ...student, unreadCount: 0 } : student));
        return;
      }
      loadStudents();
    };
    socket.on("unread:message", onUnread);
    return () => socket.off("unread:message", onUnread);
  }, [isStudent, socket, subject._id, selected?._id]);

  if (isStudent) {
    const assignment = subject.assignments?.find((item) => item.section === user.section);
    const facultyId = assignment?.faculty?._id || assignment?.faculty;
    return facultyId
      ? <DirectChat subjectId={subject._id} studentId={user.id} facultyId={facultyId} studentName="Private chat with your lecturer" />
      : <EmptyState title="No lecturer assigned" subtitle="Your section does not have a lecturer assigned for this subject yet." />;
  }

  const visibleStudents = students
    .filter((student) => `${student.name} ${student.rollNumber}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <div className="card max-h-[32rem] space-y-1.5 overflow-y-auto !p-3">
        <label className="relative mb-2 block">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field !pl-10 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or roll number" />
        </label>
        {visibleStudents.length === 0 && <p className="p-2 text-xs text-slate-400">{students.length ? "No matching students." : "No students in your sections."}</p>}
        {visibleStudents.map((s) => {
          const isSelected = selected?._id === s._id;
          return (
            <button key={s._id} onClick={() => {
              setSelected(s);
              setStudents((current) => current.map((student) => student._id === s._id ? { ...student, unreadCount: 0 } : student));
            }}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 ${isSelected ? `${theme.activePill} shadow-xs` : "hover:bg-slate-50 text-slate-700"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-bold">{s.name}</span>
                {s.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">{s.unreadCount > 99 ? "99+" : s.unreadCount}</span>}
              </span>
              <p className={`truncate text-xs ${isSelected ? "text-white/80" : "text-slate-400"}`}>{s.lastMessage || `${s.rollNumber} · Sec ${s.section}`}</p>
            </button>
          );
        })}
      </div>
      {selected ? <DirectChat key={selected._id} subjectId={subject._id} studentId={selected._id} facultyId={user.id} studentName={selected.name} />
        : <EmptyState title="Select a student" subtitle="Pick a student to open your private chat." />}
    </div>
  );
}

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const theme = getPortalTheme(user?.role);
  const [subject, setSubject] = useState(null);
  const [tab, setTab] = useState(searchParams.get("tab") || "materials");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setTab(t);
  }, [searchParams]);
  const { socket } = useSocket();
  const onResourceTypeRead = useCallback((type) => {
    setSubject((current) => ({
      ...current,
      unreadResourceCounts: { ...current.unreadResourceCounts, [type]: 0 },
    }));
  }, []);

  useEffect(() => { api.get(`/subjects/${subjectId}`).then((r) => setSubject(r.data.subject)); }, [subjectId]);
  useEffect(() => {
    if (!socket || !subject) return;
    const onUnread = ({ kind, id, subjectId: messageSubjectId }) => {
      if (kind === "subject" && id === subject._id && tab !== "community") {
        setSubject((current) => ({ ...current, unreadDiscussionCount: (current.unreadDiscussionCount || 0) + 1 }));
      }
      if (kind === "direct" && messageSubjectId === subject._id && tab !== "lecturer") {
        setSubject((current) => ({ ...current, unreadDirectCount: (current.unreadDirectCount || 0) + 1 }));
      }
    };
    socket.on("unread:message", onUnread);
    return () => socket.off("unread:message", onUnread);
  }, [socket, subject, tab]);
  useEffect(() => {
    if (!socket || !subject) return;
    const onResource = ({ subjectId: resourceSubjectId, type }) => {
      if (resourceSubjectId !== subject._id) return;
      setSubject((current) => ({
        ...current,
        unreadResourceCounts: { ...current.unreadResourceCounts, [type]: (current.unreadResourceCounts?.[type] || 0) + 1 },
      }));
    };
    socket.on("resource:new", onResource);
    return () => socket.off("resource:new", onResource);
  }, [socket, subject]);
  if (!subject) return <div className="p-8 text-slate-400">Loading...</div>;

  const canUpload = ["faculty", "hod"].includes(user.role);
  const canBookmark = true;
  const isStudent = user.role === "student" || user.role === "coordinator";
  const tabs = [
    ["materials", "Materials", Object.values(subject.unreadResourceCounts || {}).reduce((total, count) => total + count, 0)],
    ["community", "Community", subject.unreadDiscussionCount],
    ["lecturer", isStudent ? "Ask lecturer" : "Student chats", subject.unreadDirectCount || 0],
  ];

  return (
    <>
      <Topbar title={subject.name} subtitle={`${subject.code} · ${subject.branch?.code} · Year ${subject.year} · Semester ${subject.semester}`}>
        <Link to=".." relative="path" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
      </Topbar>
      <div className="space-y-6 p-8">
        <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-3">
          {tabs.map(([key, label, unreadCount]) => {
            const isTabActive = tab === key;
            return (
              <button key={key} onClick={() => {
                setTab(key);
                if (key === "community") setSubject((current) => ({ ...current, unreadDiscussionCount: 0 }));
                if (key === "lecturer") setSubject((current) => ({ ...current, unreadDirectCount: 0 }));
              }}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  isTabActive
                    ? `${theme.activePill} shadow-sm`
                    : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                }`}>
                <span className="flex items-center gap-2">{label}
                  {unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {tab === "materials" && <Materials
          subjectId={subjectId}
          canUpload={canUpload}
          canBookmark={canBookmark}
          unreadCounts={subject.unreadResourceCounts}
          onTypeRead={onResourceTypeRead}
        />}
        {tab === "community" && <Community subjectId={subjectId} />}
        {tab === "lecturer" && <Lecturer subject={subject} user={user} />}
      </div>
    </>
  );
}
