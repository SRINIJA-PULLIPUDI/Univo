import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Download,
  ExternalLink,
  RotateCcw,
  Search,
  X,
  FileSpreadsheet,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import api from "../api/axios";
import { useSocket } from "../context/SocketContext";
import Topbar from "../components/Topbar";
import { EmptyState, Modal } from "../components/ui";
import { downloadUpload, openUpload } from "../utils/uploadUrls";

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending Task"],
  ["pendingReview", "Pending Review"],
  ["reviewed", "Reviewed"],
  ["rejected", "Rejected"],
];

export default function AssignmentDetails() {
  const { taskId } = useParams();
  const { socket } = useSocket();
  const [task, setTask] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState("all");
  const [studentQuery, setStudentQuery] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/tasks/assigned/${taskId}`);
      setTask(response.data.task);
      setSubmissions(response.data.submissions);
      setCounts(response.data.counts);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load assignment statistics.");
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on("task:submission", load);
    socket.on("task:status", load);
    return () => {
      socket.off("task:submission", load);
      socket.off("task:status", load);
    };
  }, [socket, load]);

  async function review(submission) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/tasks/submissions/${submission._id}/verify`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not review this submission.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchReview() {
    if (selectedSubmissions.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/tasks/submissions/batch-verify", { submissionIds: selectedSubmissions });
      setSelectedSubmissions([]);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not review selected submissions.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadExcel() {
    setDownloadingExcel(true);
    setError("");
    try {
      const response = await api.get(`/tasks/assigned/${taskId}/export-excel`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(task?.title || "Assignment").replace(/[^a-zA-Z0-9_-]/g, "_")}_Submissions.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError("Could not export assignment submissions to Excel.");
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function reject(event) {
    event.preventDefault();
    if (!rejecting) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/tasks/submissions/${rejecting._id}/reject`, { reason: reason.trim() });
      setRejecting(null);
      setReason("");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not reject this submission.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => submissions.filter((submission) => {
    const query = studentQuery.trim().toLowerCase();
    const matchesStudent = !query || `${submission.student?.name || ""} ${submission.student?.rollNumber || ""}`.toLowerCase().includes(query);
    if (!matchesStudent) return false;
    if (filter === "pending") return submission.status === "pending" && !submission.verified;
    if (filter === "pendingReview") return submission.status === "completed" && !submission.verified;
    if (filter === "reviewed") return submission.verified;
    if (filter === "rejected") return submission.status === "rejected" && !submission.verified;
    return true;
  }), [submissions, filter, studentQuery]);

  // Submissions eligible for batch review in the current view (submitted/completed but not yet verified)
  const eligibleSubmissions = useMemo(
    () => filtered.filter((s) => s.status === "completed" && !s.verified),
    [filtered]
  );

  const allEligibleSelected =
    eligibleSubmissions.length > 0 &&
    eligibleSubmissions.every((s) => selectedSubmissions.includes(s._id));

  function toggleSelectAll() {
    if (allEligibleSelected) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(eligibleSubmissions.map((s) => s._id));
    }
  }

  function toggleSelect(id) {
    setSelectedSubmissions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const STAT_ITEMS = [
    { label: "Total Students", count: counts.total || 0, key: "all", icon: Users },
    { label: "Pending Task", count: counts.pending || 0, key: "pending", icon: Clock },
    { label: "Pending Review", count: counts.pendingReview || 0, key: "pendingReview", icon: AlertCircle },
    { label: "Reviewed", count: counts.reviewed || 0, key: "reviewed", icon: CheckCircle2 },
    { label: "Rejected", count: counts.rejected || 0, key: "rejected", icon: XCircle },
  ];

  return (
    <>
      <Topbar title={task?.title || "Assignment statistics"} subtitle={task ? `Year ${task.year}${task.section ? ` · Section ${task.section}` : ""}` : "Review assignment submissions."}>
        <div className="flex items-center gap-3">
          <Link to="/app/tasks" className="btn-secondary"><ArrowLeft size={16} /> Back to Assignments</Link>
        </div>
      </Topbar>
      <div className="space-y-6 p-6">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!task && !error ? <EmptyState title="Loading assignment..." /> : task && (
          <>
            {/* Navigable Interactive Statistics Cards with Faculty Portal Blue Theme */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {STAT_ITEMS.map(({ label, count, key, icon: Icon }) => {
                const isActive = filter === key;
                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() => {
                      setFilter(key);
                      setSelectedSubmissions([]);
                    }}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer shadow-xs ${
                      isActive
                        ? "border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/30 shadow-md"
                        : "border-slate-200 bg-white hover:border-sky-300 hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                          isActive
                            ? "bg-sky-600 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                    </div>
                    <p className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight">{count}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2.5">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Active View
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700 transition-colors">
                          Click to filter →
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-slate-400">
                        {count === 1 ? "1 student" : `${count} students`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Assignment Info Header with Download Excel Button */}
            <section className="card !p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-slate-900">{task.title}</h2>
                  {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">{task.description}</p>}
                  <p className="mt-2 text-xs text-slate-400 font-medium flex items-center gap-2">
                    <span>{task.dueDate ? `Due ${format(parseISO(String(task.dueDate).slice(0, 10)), "d MMM yyyy")}` : "No due date"}</span>
                    <span>•</span>
                    <span className={task.proofRequired ? "text-amber-600 font-semibold" : "text-sky-600 font-semibold"}>
                      {task.proofRequired ? "Proof Compulsory" : "Proof Optional (Batch Review Enabled in Pending Review)"}
                    </span>
                  </p>
                </div>

                {/* Download Excel Button on the right end */}
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel}
                  className="btn-secondary flex items-center gap-2 !py-2.5 !px-4 text-emerald-700 hover:bg-emerald-50 border-emerald-200 cursor-pointer shadow-xs font-semibold shrink-0"
                >
                  <FileSpreadsheet size={18} className="text-emerald-600" />
                  <span>{downloadingExcel ? "Generating Excel..." : "Download Excel"}</span>
                </button>
              </div>
            </section>

            {/* Submissions Section */}
            <section className="card !p-0 overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-bold text-slate-900">{FILTERS.find(([key]) => key === filter)?.[1]} · {filtered.length}</h2>
                  <label className="relative block w-full max-w-sm">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="input-field !pl-10 text-xs" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search students by name or roll number" />
                  </label>
                </div>
              </div>

              {/* Batch Review Action Bar only available in Pending Review when Proof is NOT Compulsory */}
              {!task.proofRequired && filter === "pendingReview" && eligibleSubmissions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-sky-50/70 border-b border-sky-100 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-900 select-none">
                      <input
                        type="checkbox"
                        checked={allEligibleSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <span>Select All in Pending Review ({eligibleSubmissions.length})</span>
                    </label>
                    {selectedSubmissions.length > 0 && (
                      <span className="rounded-full bg-sky-200 px-2.5 py-0.5 text-xs font-bold text-sky-800">
                        {selectedSubmissions.length} selected
                      </span>
                    )}
                  </div>

                  {selectedSubmissions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleBatchReview}
                        className="btn-primary !bg-sky-600 hover:!bg-sky-700 flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs shadow-xs cursor-pointer font-semibold"
                      >
                        <BadgeCheck size={15} />
                        <span>Review Selected ({selectedSubmissions.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSubmissions([])}
                        className="btn-secondary !py-1.5 !px-2.5 text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {filtered.length === 0 ? <EmptyState title="No submissions in this status" /> : (
                <ul className="divide-y divide-slate-100 px-5">
                  {filtered.map((submission) => {
                    const isSelectable = !task.proofRequired && filter === "pendingReview" && submission.status === "completed" && !submission.verified;
                    const isChecked = selectedSubmissions.includes(submission._id);
                    const canReview = submission.status === "completed" && !submission.verified;

                    return (
                      <li key={submission._id} className="flex flex-wrap items-center gap-3 py-4">
                        {isSelectable && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(submission._id)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer mr-1"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900">{submission.student?.name || "Student"}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{submission.student?.rollNumber || "No roll number"}{submission.student?.section ? ` · Section ${submission.student.section}` : ""}</p>
                          {submission.rejectionReason && <p className="mt-1 text-xs text-rose-600 font-medium">Feedback: {submission.rejectionReason}</p>}
                        </div>
                        {submission.proofUrl && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { void openUpload(submission.proofUrl, submission.proofFileName).catch((error) => window.alert(error.response?.data?.message || error.message || "Could not open this file.")); }} className="btn-secondary !py-1.5"><ExternalLink size={14} /> Open proof</button>
                            <button type="button" onClick={() => { void downloadUpload(submission.proofUrl, submission.proofFileName).catch((error) => window.alert(error.response?.data?.message || "Could not download this file.")); }} className="btn-secondary !py-1.5"><Download size={14} /> Download</button>
                          </div>
                        )}
                        <span className={`chip ${submission.verified ? "!bg-emerald-50 !text-emerald-700" : submission.status === "rejected" ? "!bg-rose-50 !text-rose-700" : ""}`}>
                          {submission.verified ? "Reviewed" : submission.status === "completed" ? "Pending Review" : submission.status === "rejected" ? "Rejected" : "Pending Task"}
                        </span>
                        {/* Only submissions in Pending Review (completed but not verified) have Review / Reject buttons. Pending Tasks have NO review button! */}
                        {canReview && (
                          <div className="flex gap-2">
                            <button type="button" className="btn-primary !bg-sky-600 hover:!bg-sky-700 !py-1.5 cursor-pointer" disabled={busy} onClick={() => review(submission)}><BadgeCheck size={14} /> Review</button>
                            <button type="button" className="btn-secondary !py-1.5 !text-rose-700 hover:!bg-rose-50 cursor-pointer" disabled={busy} onClick={() => { setRejecting(submission); setReason(""); }}><X size={14} /> Reject</button>
                          </div>
                        )}
                        {submission.status === "rejected" && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><RotateCcw size={14} /> Waiting for resubmission</span>}
                        {submission.verified && <Check size={18} className="text-emerald-600" />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {rejecting && (
        <Modal title={`Reject ${rejecting.student?.name || "submission"}`} onClose={() => { setRejecting(null); setReason(""); }}>
          <form onSubmit={reject} className="space-y-4">
            <p className="text-sm text-slate-600">The student will be notified immediately and can resubmit the assignment.</p>
            <label className="block space-y-1 text-sm font-medium">
              <span>Feedback (optional)</span>
              <textarea className="input-field" rows={4} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what should be corrected..." />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary cursor-pointer" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="btn-primary !bg-rose-600 hover:!bg-rose-700 cursor-pointer" disabled={busy}>Reject submission</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
