import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Send, Trash2, Pencil, Heart, ThumbsUp, Sparkles, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import Topbar from "../components/Topbar";
import { EmptyState } from "../components/ui";

export default function ForumPost() {
  const { postId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingBody, setEditingBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reacting, setReacting] = useState(false);

  const loadComments = useCallback(async () => {
    const response = await api.get(`/forum/${postId}/comments`);
    setComments(response.data.comments);
  }, [postId]);

  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/forum/${postId}`), api.get(`/forum/${postId}/comments`)])
      .then(([postResponse, commentsResponse]) => {
        if (!active) return;
        setPost(postResponse.data.post);
        setComments(commentsResponse.data.comments);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Could not load this Forum article.");
      });
    return () => { active = false; };
  }, [postId]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.emit("forum:join", postId);
    const receiveComment = (comment) => setComments((current) => current.some((item) => item._id === comment._id) ? current : [...current, comment]);
    const updateComment = (updated) => setComments((current) => current.map((c) => (c._id === updated._id ? updated : c)));
    const removeComment = ({ id }) => setComments((current) => current.filter((comment) => comment._id !== id));
    const handleReaction = ({ postId: id, reactions }) => {
      if (id === postId) {
        setPost((current) => current ? { ...current, reactions } : current);
      }
    };
    socket.on("forum:comment", receiveComment);
    socket.on("forum:comment:updated", updateComment);
    socket.on("forum:comment:deleted", removeComment);
    socket.on("forum:reaction", handleReaction);
    return () => {
      socket.emit("forum:leave", postId);
      socket.off("forum:comment", receiveComment);
      socket.off("forum:comment:updated", updateComment);
      socket.off("forum:comment:deleted", removeComment);
      socket.off("forum:reaction", handleReaction);
    };
  }, [socket, postId]);

  async function handleReact(type = "heart") {
    if (reacting) return;
    setReacting(true);
    try {
      const res = await api.post(`/forum/${postId}/react`, { type });
      setPost((current) => current ? { ...current, reactions: res.data.reactions } : current);
    } catch (err) {
      console.error(err);
    } finally {
      setReacting(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post(`/forum/${postId}/comments`, { body: body.trim() });
      setComments((current) => current.some((comment) => comment._id === response.data.comment._id) ? current : [...current, response.data.comment]);
      setBody("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not add your comment.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEditedComment(commentId) {
    if (!editingBody.trim()) return;
    try {
      const response = await api.put(`/forum/${postId}/comments/${commentId}`, { body: editingBody.trim() });
      setComments((current) => current.map((c) => (c._id === commentId ? response.data.comment : c)));
      setEditingCommentId(null);
      setEditingBody("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update this comment.");
    }
  }

  async function removeComment(comment) {
    if (!confirm("Delete this comment?")) return;
    try {
      await api.delete(`/forum/${postId}/comments/${comment._id}`);
      await loadComments();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not delete this comment.");
    }
  }

  return (
    <>
      <Topbar title="Forum Discussion">
        <Link to="/app/forum" className="btn-secondary !text-xs !py-1.5"><ArrowLeft size={15} /> Back to Forum</Link>
      </Topbar>
      <div className="mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
        {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 font-medium">{error}</p>}
        {!post ? (
          <EmptyState icon={MessageSquare} title={error ? "Article unavailable" : "Loading discussion..."} />
        ) : (
          <>
            {/* Article Card */}
            <article className="card !p-6 sm:!p-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="chip !bg-sky-50 !text-sky-700 !border-sky-200 font-bold">{post.category}</span>
                <span className="text-xs text-slate-400 font-medium">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{post.title}</h1>

              {/* Author Meta Row */}
              <div className="flex items-center gap-3 border-y border-slate-100 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-xs">
                  {post.postedBy?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{post.postedBy?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{post.postedBy?.role || "Campus Contributor"}</p>
                </div>
              </div>

              {post.imageUrl && (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-xs my-4">
                  <img src={post.imageUrl} alt="" className="max-h-[28rem] w-full object-cover" />
                </div>
              )}

              <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-700 pt-2 font-normal">
                {post.body}
              </div>

              {/* Reactions Bar */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Reactions:</span>
                  {[
                    { type: "heart", label: "Love", icon: Heart, activeClass: "text-rose-600 bg-rose-50 border-rose-200", iconClass: "fill-rose-500 text-rose-500" },
                    { type: "like", label: "Like", icon: ThumbsUp, activeClass: "text-blue-600 bg-blue-50 border-blue-200", iconClass: "fill-blue-500 text-blue-500" },
                    { type: "insight", label: "Insightful", icon: Lightbulb, activeClass: "text-amber-600 bg-amber-50 border-amber-200", iconClass: "fill-amber-500 text-amber-500" },
                    { type: "celebrate", label: "Celebrate", icon: Sparkles, activeClass: "text-emerald-600 bg-emerald-50 border-emerald-200", iconClass: "fill-emerald-500 text-emerald-500" },
                  ].map((btn) => {
                    const count = (post.reactions || []).filter((r) => r.type === btn.type).length;
                    const userReacted = (post.reactions || []).some(
                      (r) => String(r.user?._id || r.user) === String(user.id) && r.type === btn.type
                    );
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.type}
                        type="button"
                        onClick={() => handleReact(btn.type)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 ${
                          userReacted
                            ? btn.activeClass
                            : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <Icon size={14} className={userReacted ? btn.iconClass : "text-slate-400"} />
                        <span>{btn.label}</span>
                        {count > 0 && <span className="ml-0.5 font-extrabold">{count}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {(post.reactions || []).length} total {(post.reactions || []).length === 1 ? "reaction" : "reactions"}
                </div>
              </div>
            </article>

            {/* Comments Section */}
            <section className="card !p-6 sm:!p-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <MessageSquare size={18} />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900">Discussion & Responses</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {comments.length} {comments.length === 1 ? "comment" : "comments"}
                </span>
              </div>

              {/* Comment Thread */}
              {comments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-600">No responses yet</p>
                  <p className="mt-1 text-xs text-slate-400">Be the first to share your perspective on this topic.</p>
                </div>
              ) : (
                <div className="space-y-3.5 mb-8">
                  {comments.map((comment) => {
                    const isOwn = String(comment.postedBy?._id) === String(user.id);
                    const canDelete = isOwn || ["operator", "hod"].includes(user.role);
                    return (
                      <div
                        key={comment._id}
                        className="group rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-all duration-150 hover:bg-slate-50 hover:border-slate-200/80"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                              {comment.postedBy?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 truncate">{comment.postedBy?.name}</span>
                              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                {comment.postedBy?.role || "Member"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-slate-400 font-medium mr-1">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                            {isOwn && (
                              <button
                                type="button"
                                aria-label="Edit comment"
                                title="Edit comment"
                                onClick={() => {
                                  setEditingCommentId(comment._id);
                                  setEditingBody(comment.body);
                                }}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/80 hover:text-slate-800 transition-all cursor-pointer"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                aria-label="Delete comment"
                                title="Delete comment"
                                onClick={() => removeComment(comment)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {editingCommentId === comment._id ? (
                          <div className="pl-10 space-y-2 pt-1">
                            <textarea
                              className="input-field text-sm"
                              rows={3}
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              placeholder="Edit your comment..."
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingBody("");
                                }}
                                className="btn-secondary !py-1 !px-2.5 text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditedComment(comment._id)}
                                className="btn-primary !py-1 !px-3 text-xs cursor-pointer"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed pl-10">
                            {comment.body}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Comment Input Form */}
              <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs mt-6">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-slate-700">Join the discussion as {user.name}</span>
                </div>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-hidden transition-colors resize-y min-h-[5rem]"
                  rows={3}
                  maxLength={2000}
                  placeholder="Write a constructive comment or response..."
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
                <div className="flex items-center justify-between pt-2.5">
                  <span className="text-[11px] text-slate-400 font-medium">Markdown formatting supported</span>
                  <button
                    type="submit"
                    className="btn-primary !py-2 !px-4 !text-xs"
                    disabled={busy || !body.trim()}
                  >
                    {busy ? "Posting..." : <><Send size={13} /> Post Comment</>}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </>
  );
}
