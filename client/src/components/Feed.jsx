import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Pencil, Plus, Search, Trash2, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import { EmptyState, Modal, FileDrop } from "../components/ui";
import { useSocket } from "../context/SocketContext";
import { getPortalTheme } from "../utils/portalThemes";

export default function Feed({ title, subtitle, endpoint, socketEvent, categories, icon }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const theme = getPortalTheme(user?.role);
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: categories[0] });
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const [editingPost, setEditingPost] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", category: categories[0] });
  const [editImage, setEditImage] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const canPost = ["coordinator", "hod", "operator"].includes(user?.role);

  const load = () => api.get(endpoint).then((r) => setPosts(r.data.posts));
  useEffect(() => { load(); }, [endpoint]);
  useEffect(() => {
    if (!socket) return;
    socket.on(socketEvent, load);
    socket.on("buzz:deleted", load);
    const onReaction = ({ postId, reactions }) => {
      setPosts((current) => current.map((p) => p._id === postId ? { ...p, reactions } : p));
    };
    if (title === "Forum") {
      socket.on("forum:deleted", load);
      socket.on("forum:comment:changed", load);
      socket.on("forum:reaction", onReaction);
    }
    return () => {
      socket.off(socketEvent, load);
      socket.off("buzz:deleted", load);
      if (title === "Forum") {
        socket.off("forum:deleted", load);
        socket.off("forum:comment:changed", load);
        socket.off("forum:reaction", onReaction);
      }
    };
  }, [socket, socketEvent, title]);

  async function handleReaction(id) {
    if (title !== "Forum") return;
    try {
      const res = await api.post(`/forum/${id}/react`, { type: "heart" });
      setPosts((current) => current.map((p) => p._id === id ? { ...p, reactions: res.data.reactions } : p));
    } catch (e) {
      console.error(e);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (image) fd.append("image", image);
    try {
      await api.post(endpoint, fd);
      setShow(false); setForm({ title: "", body: "", category: categories[0] }); setImage(null); load();
    } finally { setBusy(false); }
  }

  function startEdit(post) {
    setEditingPost(post);
    setEditForm({ title: post.title, body: post.body, category: post.category });
    setEditImage(null);
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (!editingPost) return;
    setEditBusy(true);
    const fd = new FormData();
    Object.entries(editForm).forEach(([k, v]) => fd.append(k, v));
    if (editImage) fd.append("image", editImage);
    try {
      await api.patch(`${endpoint}/${editingPost._id}`, fd);
      setEditingPost(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update post");
    } finally {
      setEditBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm("Remove this post?")) return;
    await api.delete(`${endpoint}/${id}`);
    load();
  }

  const shown = posts.filter((post) => {
    const matchesCategory = category === "All" || post.category === category;
    const searchable = `${post.title} ${post.body} ${post.category} ${post.postedBy?.name || ""}`.toLowerCase();
    return matchesCategory && searchable.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <Topbar title={title} subtitle={subtitle}>
        {canPost && <button className="btn-primary" onClick={() => setShow(true)}><Plus size={16} /> New post</button>}
      </Topbar>
      <div className="space-y-6 p-8">
        <label className="relative block max-w-lg">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} />
        </label>
        <div className="flex flex-wrap gap-2">
          {["All", ...categories].map((c) => {
            const isSelected = category === c;
            return (
              <button key={c} onClick={() => setCategory(c)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  isSelected
                    ? `${theme.activePill} border-transparent shadow-sm`
                    : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                }`}>
                {c}
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={icon} title="Nothing here yet" subtitle="Posts will show up here." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((p, index) => {
              const isAuthor = String(p.postedBy?._id || p.postedBy) === String(user?.id || user?._id);
              return (
                <article key={p._id} className="card card-hover overflow-hidden !p-0">
                  <div className={`flex min-h-56 flex-col ${p.imageUrl ? (index % 2 ? "sm:flex-row-reverse" : "sm:flex-row") : ""}`}>
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="h-48 w-full object-cover sm:h-auto sm:w-2/5" />}
                    <div className="flex min-w-0 flex-1 flex-col p-5">
                      <span className="chip mb-2 self-start">{p.category}</span>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">{p.title}</h3>
                      <p className="mt-2 flex-1 text-sm text-slate-600 leading-relaxed">{p.body.length > 220 ? `${p.body.slice(0, 220).trimEnd()}...` : p.body}</p>
                      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="min-w-0 truncate">{p.postedBy?.name} · {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          {title === "Forum" && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); handleReaction(p._id); }}
                              className={`inline-flex items-center gap-1 font-semibold transition-colors px-2 py-0.5 rounded-lg text-xs ${
                                (p.reactions || []).some((r) => String(r.user?._id || r.user) === String(user?.id || user?._id))
                                  ? "text-rose-600 bg-rose-50 font-bold"
                                  : "text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                              }`}
                              title="React with Heart"
                            >
                              <Heart
                                size={13}
                                className={(p.reactions || []).some((r) => String(r.user?._id || r.user) === String(user?.id || user?._id)) ? "fill-rose-500 text-rose-500" : ""}
                              />
                              <span>{(p.reactions || []).length}</span>
                            </button>
                          )}
                          {title === "Forum" && <span className="inline-flex items-center gap-1 font-semibold text-slate-600"><MessageSquare size={13} /> {p.commentCount || 0}</span>}
                          {isAuthor && (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => startEdit(p)} aria-label={`Edit ${p.title}`} title="Edit post" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => remove(p._id)} aria-label={`Delete ${p.title}`} title="Delete post" className="rounded-md p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {title === "Forum" && <Link to={`/app/forum/${p._id}`} className="mt-3 text-xs font-bold text-portal hover:underline">Read full discussion →</Link>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {show && (
        <Modal title={`New ${title} post`} onClose={() => setShow(false)} wide>
          <form onSubmit={submit} className="space-y-3">
            <input className="input-field" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <textarea className="input-field" rows={4} placeholder="Write the update..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <FileDrop file={image} setFile={setImage} accept="image/*" label="Optional cover image" />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn-primary" disabled={busy}>{busy ? "Posting..." : "Post"}</button>
            </div>
          </form>
        </Modal>
      )}

      {editingPost && (
        <Modal title={`Edit ${title} post`} onClose={() => setEditingPost(null)} wide>
          <form onSubmit={submitEdit} className="space-y-3">
            <input className="input-field" placeholder="Title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            <textarea className="input-field" rows={4} placeholder="Write the update..." value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} required />
            <select className="input-field" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <FileDrop file={editImage} setFile={setEditImage} accept="image/*" label="Replace cover image (optional)" />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditingPost(null)}>Cancel</button>
              <button className="btn-primary" disabled={editBusy}>{editBusy ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
