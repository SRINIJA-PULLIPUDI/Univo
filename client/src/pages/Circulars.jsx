import { useEffect, useState } from "react";
import { FileText, Download, ExternalLink, Plus, Search, Trash2, Bookmark, BookmarkCheck, Eye } from "lucide-react";
import { format } from "date-fns";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import { EmptyState, Modal, FileDrop } from "../components/ui";
import { useSocket } from "../context/SocketContext";
import { downloadUpload, openUpload } from "../utils/uploadUrls";
import { getPortalTheme } from "../utils/portalThemes";

const CATEGORIES = ["Academic", "Administrative", "Examination", "Event", "Placement", "Other"];

function UploadModal({ onClose, onDone }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Academic");
  const [years, setYears] = useState([]);
  const [sections, setSections] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleYear = (y) => setYears((prev) => (prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y]));

  async function submit(e) {
    e.preventDefault();
    if (!file) return setError("Please choose a file");
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("description", description);
    fd.append("category", category);
    fd.append("years", JSON.stringify(years));
    // only faculty may target sections (per the spec); HOD/operator are year-wise
    if (user.role === "faculty") {
      fd.append("sections", JSON.stringify(sections.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)));
    }
    try {
      await api.post("/circulars", fd);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Upload circular" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <input className="input-field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="input-field" rows={2} placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {user.role === "faculty" && (
            <input className="input-field" placeholder="Sections e.g. A, B (blank = all)" value={sections} onChange={(e) => setSections(e.target.value)} />
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Target years <span className="text-slate-400 font-normal">(none selected = all years)</span></p>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((y) => (
              <button type="button" key={y} onClick={() => toggleYear(y)}
                className={`rounded-xl border px-4 py-1.5 text-xs font-bold transition-all ${years.includes(y) ? "bg-slate-900 border-slate-900 text-white shadow-xs" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                Year {y}
              </button>
            ))}
          </div>
        </div>
        <FileDrop file={file} setFile={setFile} label="Choose or drop the circular (PDF, DOC, image)" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Uploading..." : "Upload"}</button>
        </div>
      </form>
    </Modal>
  );
}

import BookmarkFolderModal from "../components/BookmarkFolderModal";

export default function Circulars() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState([]);
  const [bookmarkMap, setBookmarkMap] = useState({});
  const [activeBookmarkModal, setActiveBookmarkModal] = useState(null); // { id, title, isBookmarked, folder }
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const canUpload = ["hod", "faculty", "operator"].includes(user.role);
  const canBookmark = true;
  const theme = getPortalTheme(user.role);

  const load = () => api.get("/circulars").then((r) => setItems(r.data.circulars));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!socket) return;
    socket.on("circular:new", load);
    return () => socket.off("circular:new", load);
  }, [socket]);

  const loadBookmarks = () => {
    if (!canBookmark) return;
    api.get("/bookmarks").then((r) => {
      const map = {};
      (r.data.bookmarks || []).forEach((b) => {
        if (b.circular?._id) {
          map[b.circular._id] = { id: b._id, folder: b.folder || "General" };
        }
      });
      setBookmarkMap(map);
    });
  };

  useEffect(() => {
    loadBookmarks();
  }, [canBookmark]);

  async function handleSaveBookmark(folders) {
    if (!activeBookmarkModal) return;
    const folderList = Array.isArray(folders) ? folders : [folders || "General"];
    await api.post("/bookmarks", { circularId: activeBookmarkModal.id, folders: folderList, type: "circular" });
    loadBookmarks();
  }

  async function handleRemoveBookmark() {
    if (!activeBookmarkModal) return;
    await api.delete(`/bookmarks/${activeBookmarkModal.id}`, { data: { type: "circular" } });
    loadBookmarks();
  }

  async function remove(id, e) {
    e?.stopPropagation();
    if (!confirm("Remove this circular?")) return;
    await api.delete(`/circulars/${id}`);
    load();
  }

  async function markRead(circular) {
    try {
      await api.post(`/circulars/${circular._id}/read`);
      setItems((current) => current.map((item) => item._id === circular._id
        ? { ...item, readBy: [...(item.readBy || []), user.id] }
        : item));
    } catch {
      // quiet fail
    }
  }

  function unreadCircular(circular) {
    return String(circular.uploadedBy?._id) !== String(user.id)
      && !(circular.readBy || []).some((reader) => String(reader) === String(user.id));
  }

  const filtered = items.filter((c) => {
    const matchesCategory = category === "All" || c.category === category;
    const searchable = `${c.title} ${c.description} ${c.category} ${c.uploadedBy?.name || ""}`.toLowerCase();
    return matchesCategory && searchable.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <Topbar title="Circulars" subtitle="Official notices, targeted to the right year and section.">
        {canUpload && (
          <button className="btn-primary" onClick={() => setShowUpload(true)}>
            <Plus size={16} /> Upload circular
          </button>
        )}
      </Topbar>
      <div className="space-y-6 p-8">
        <label className="relative block max-w-lg">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search circulars by title, category, or faculty" />
        </label>
        
        {/* Sleek rounded-xl Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {["All", ...CATEGORIES].map((c) => {
            const unreadCount = items.filter((item) => (c === "All" || item.category === c) && unreadCircular(item)).length;
            const isSelected = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 border ${
                  isSelected
                    ? `${theme.activePill} border-transparent shadow-xs`
                    : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                }`}
              >
                <span className="flex items-center gap-2">
                  {c}
                  {unreadCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No circulars" subtitle="New circulars for you will show up here." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((c) => (
              <div
                key={c._id}
                onClick={() => {
                  void openUpload(c.fileUrl, c.fileName).catch((error) =>
                    window.alert(error.response?.data?.message || error.message || "Could not open this file.")
                  );
                  void markRead(c);
                }}
                className="card card-hover group flex items-start gap-4 cursor-pointer transition-all duration-150 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-violet-100 group-hover:text-violet-700 transition-colors">
                  <FileText size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="chip">{c.category}</span>
                    {unreadCircular(c) && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                        1
                      </span>
                    )}
                    {c.years?.length > 0 && <span className="text-xs text-slate-400 font-medium">Year {c.years.join(", ")}</span>}
                    {c.sections?.length > 0 && <span className="text-xs text-slate-400 font-medium">Sec {c.sections.join(", ")}</span>}
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-slate-900 group-hover:text-primary transition-colors">
                    {c.title}
                  </h3>
                  {c.description && <p className="mt-0.5 text-sm text-slate-600 leading-relaxed">{c.description}</p>}
                  <p className="mt-2 text-xs text-slate-400 font-medium">
                    {c.uploadedBy?.name} · {format(new Date(c.createdAt), "d MMM yyyy")}
                  </p>
                  
                  {/* Action buttons: Bookmark, Download, and Trash */}
                  <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {canBookmark && (
                      <button
                        type="button"
                        onClick={() => {
                          const isBookmarked = Boolean(bookmarkMap[c._id]);
                          setActiveBookmarkModal({
                            id: c._id,
                            title: c.title,
                            isBookmarked,
                            folder: bookmarkMap[c._id]?.folder || "General",
                          });
                        }}
                        className="btn-ghost"
                        title={bookmarkMap[c._id] ? `Bookmarked in ${bookmarkMap[c._id].folder}` : "Add to bookmarks"}
                      >
                        {bookmarkMap[c._id] ? (
                          <BookmarkCheck size={18} className="text-violet-600" />
                        ) : (
                          <Bookmark size={18} />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        void openUpload(c.fileUrl, c.fileName).catch((error) =>
                          window.alert(error.response?.data?.message || error.message || "Could not open this file.")
                        );
                        void markRead(c);
                      }}
                      className="btn-secondary !py-1.5 flex items-center gap-1.5"
                      aria-label={`Preview ${c.title}`}
                      title="Preview"
                    >
                      <Eye size={14} /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void downloadUpload(c.fileUrl, c.fileName).catch((error) =>
                          window.alert(error.response?.data?.message || "Could not download this file.")
                        );
                      }}
                      className="btn-secondary !py-1.5 flex items-center gap-1.5"
                      aria-label={`Download ${c.title}`}
                      title="Download"
                    >
                      <Download size={14} /> Download
                    </button>
                    {!["student", "coordinator"].includes(user.role) && (
                      <button
                        type="button"
                        onClick={(e) => remove(c._id, e)}
                        className="btn-ghost !text-red-600 hover:!bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); load(); }} />}
    </>
  );
}
