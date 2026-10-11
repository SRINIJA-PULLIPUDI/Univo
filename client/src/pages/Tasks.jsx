import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Plus, Upload, BadgeCheck, Download, ExternalLink, Search, Trash2, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import { EmptyState, Modal } from "../components/ui";
import { useSocket } from "../context/SocketContext";
import { downloadUpload, openUpload } from "../utils/uploadUrls";
import { getPortalTheme } from "../utils/portalThemes";

function StudentTasks() {
  const { user } = useAuth();
  const theme = getPortalTheme(user?.role);
  const { socket } = useSocket();
  const [subs, setSubs] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const today = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(() => api.get("/tasks/mine").then((r) => {
    setSubs(r.data.submissions);
    setLoadError("");
  }).catch((error) => {
    setLoadError(error.response?.data?.message || "Could not load assignments.");
  }), []);
  useEffect(() => {
    api.post("/tasks/notifications/read").catch((error) => {
      setLoadError(error.response?.data?.message || "Could not update assignment notifications.");
    });
    load();
  }, [load]);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on("task:new", load);
    socket.on("task:status", load);
    return () => {
      socket.off("task:new", load);
      socket.off("task:status", load);
    };
  }, [socket, load]);

  async function complete(taskId) {
    await api.post(`/tasks/${taskId}/complete`);
    load();
  }

  async function uploadProof(taskId, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("proof", file);
    await api.post(`/tasks/${taskId}/proof`, fd);
    load();
  }

  async function deleteProof(submissionId) {
    if (!confirm("Delete this proof file?")) return;
    await api.delete(`/tasks/submissions/${submissionId}/proof`);
    load();
  }

  async function deleteStudentAssignment(submissionId) {
    if (!confirm("Delete this reviewed assignment from your assignments list?")) return;
    try {
      await api.delete(`/tasks/submissions/${submissionId}`);
      load();
    } catch (error) {
      window.alert(error.response?.data?.message || "Could not delete this assignment.");
    }
  }

  const shown = subs.filter((submission) => {
    const matchesQuery = `${submission.task.title} ${submission.task.description} ${submission.task.assignedBy?.name || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = status === "All"
      || (status === "Pending" && ["pending", "rejected"].includes(submission.status))
      || (status === "Submitted" && submission.status === "completed" && !submission.verified)
      || (status === "Reviewed" && submission.verified)
      || (status === "Rejected" && submission.status === "rejected");
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["All", "Pending", "Submitted", "Reviewed", "Rejected"].map((filter) => {
          const isSelected = status === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setStatus(filter)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 border ${
                isSelected
                  ? `${theme.activePill} border-transparent shadow-xs`
                  : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>
      {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{loadError}</p>}
      <label className="relative block max-w-lg">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input-field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments" />
      </label>
      {!subs.length ? <EmptyState icon={CheckSquare} title="No assignments yet" subtitle="Assignments from your faculty will appear here." /> : shown.length === 0 ? <EmptyState icon={Search} title="No matching assignments" /> : shown.map((s) => {
        const isOverdue = Boolean(s.task?.dueDate && String(s.task.dueDate).slice(0, 10) < today && !s.verified && s.status !== "completed");
        return (
          <div key={s._id} className="card card-hover flex items-center gap-4 !p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              <CheckSquare size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{s.task.title}</p>
              <p className="text-sm text-slate-600 mt-0.5">{s.task.description}</p>
              <p className="mt-1 text-xs text-slate-400 font-medium">
                From {s.task.assignedBy?.name}
                {s.task.dueDate && ` · Due ${format(parseISO(String(s.task.dueDate).slice(0, 10)), "d MMM")}`}
                {isOverdue && <span className="ml-1 text-rose-600 font-semibold">(Overdue)</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {s.status === "rejected" && !isOverdue && <span className="chip !bg-rose-50 !text-rose-700 border border-rose-200">Rejected · Resubmit</span>}
              {isOverdue && s.status !== "completed" && (
                <span className="chip !bg-rose-50 !text-rose-700 border border-rose-200">Overdue · Submissions closed</span>
              )}
              {s.rejectionReason && <span className="max-w-56 text-xs text-rose-600">{s.rejectionReason}</span>}
              {s.status === "completed" ? (
                <span className="chip flex items-center gap-1">{s.verified ? <><BadgeCheck size={14} /> Reviewed</> : "Submitted"}</span>
              ) : !isOverdue ? (
                <button className="btn-primary" disabled={s.task.proofRequired && !s.proofUrl} title={s.task.proofRequired && !s.proofUrl ? "Upload proof first" : undefined} onClick={() => complete(s.task._id)}>{s.status === "rejected" ? "Resubmit assignment" : "Submit assignment"}</button>
              ) : null}
              {s.proofUrl && (
                <>
                  <button type="button" onClick={() => { void openUpload(s.proofUrl, s.proofFileName).catch((error) => window.alert(error.response?.data?.message || error.message || "Could not open this file.")); }} className="btn-secondary !py-1.5"><ExternalLink size={14} /> Open proof</button>
                  <button type="button" onClick={() => { void downloadUpload(s.proofUrl, s.proofFileName).catch((error) => window.alert(error.response?.data?.message || "Could not download this file.")); }} className="btn-secondary !py-1.5"><Download size={14} /> Download</button>
                  {!s.verified && !isOverdue && (
                    <button className="btn-ghost !text-rose-600 hover:!bg-rose-50 cursor-pointer" aria-label="Delete proof" title="Delete proof" onClick={() => deleteProof(s._id)}><Trash2 size={16} /></button>
                  )}
                </>
              )}
              {s.verified && (
                <button
                  type="button"
                  className="btn-ghost !text-rose-600 hover:!bg-rose-50 cursor-pointer"
                  aria-label="Delete reviewed assignment"
                  title="Delete reviewed assignment"
                  onClick={() => deleteStudentAssignment(s._id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
              {!s.proofUrl && !isOverdue && s.status !== "completed" && (
                <label className="btn-secondary cursor-pointer !py-1.5">
                  <Upload size={14} /> Upload proof
                  <input type="file" className="hidden" onChange={(e) => uploadProof(s.task._id, e.target.files?.[0])} />
                </label>
              )}
              {s.status !== "completed" && !isOverdue && s.task.proofRequired && !s.proofUrl && <span className="text-xs text-slate-400">Proof required</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssignModal({ onClose, onDone }) {
  const [form, setForm] = useState({ title: "", description: "", year: 3, section: "", rollNumbers: "", dueDate: "", proofRequired: false });
  const [rollNumbersFile, setRollNumbersFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const today = format(new Date(), "yyyy-MM-dd");

  function changeDueDate(e) {
    const dueDate = e.target.value;
    setForm((current) => ({ ...current, dueDate }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (form.dueDate && form.dueDate < today) {
      setBusy(false);
      return;
    }
    try {
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description);
      body.append("year", String(Number(form.year)));
      body.append("section", form.section.trim().toUpperCase());
      body.append("rollNumbers", JSON.stringify(form.rollNumbers.split(",").map((r) => r.trim()).filter(Boolean)));
      body.append("dueDate", form.dueDate || "");
      body.append("proofRequired", String(form.proofRequired));
      if (rollNumbersFile) body.append("rollNumbersFile", rollNumbersFile);
      await api.post("/tasks", body);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create the assignment");
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Create an assignment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <input className="input-field" placeholder="Title" value={form.title} onChange={set("title")} required />
        <textarea className="input-field" rows={2} placeholder="Description" value={form.description} onChange={set("description")} />
        <div className="grid grid-cols-2 gap-3">
          <select className="input-field" value={form.year} onChange={set("year")}>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <input className="input-field" placeholder="Section (blank = all)" value={form.section} onChange={set("section")} />
        </div>
        <input className="input-field" placeholder="Roll numbers, comma separated (blank = everyone)" value={form.rollNumbers} onChange={set("rollNumbers")} />
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span>Or upload roll numbers (.xlsx)</span>
          <input className="input-field" type="file" accept=".xlsx" onChange={(e) => setRollNumbersFile(e.target.files?.[0] || null)} />
          {rollNumbersFile && <span className="block text-xs text-slate-400">{rollNumbersFile.name}</span>}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={form.proofRequired} onChange={(e) => setForm({ ...form, proofRequired: e.target.checked })} />
          Proof is compulsory
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Due date</span>
          <input className="input-field" type="date" min={today} value={form.dueDate} onChange={changeDueDate} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>Create assignment</button>
        </div>
      </form>
    </Modal>
  );
}

function EditAssignModal({ task, onClose, onDone }) {
  const [form, setForm] = useState({
    title: task.title || "",
    description: task.description || "",
    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
    proofRequired: Boolean(task.proofRequired),
    rollNumbers: "",
  });
  const [rollNumbersFile, setRollNumbersFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description);
      body.append("dueDate", form.dueDate || "");
      body.append("proofRequired", String(form.proofRequired));
      if (form.rollNumbers.trim()) {
        body.append("rollNumbers", form.rollNumbers.trim());
      }
      if (rollNumbersFile) {
        body.append("rollNumbersFile", rollNumbersFile);
      }
      await api.put(`/tasks/${task._id}`, body);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the assignment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit Assignment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
          <input className="input-field" placeholder="Assignment Title" value={form.title} onChange={set("title")} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
          <textarea className="input-field" rows={2} placeholder="Description" value={form.description} onChange={set("description")} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
          <input
            className="input-field"
            type="date"
            min={today}
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Extend the due date to allow overdue students to submit.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 pt-1">
          <input
            type="checkbox"
            checked={form.proofRequired}
            onChange={(e) => setForm({ ...form, proofRequired: e.target.checked })}
          />
          Proof is compulsory
        </label>
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Assign to additional missed students (Roll Numbers)
          </label>
          <input
            className="input-field"
            placeholder="e.g. 23MH1A0501, 23MH1A0502 (comma separated)"
            value={form.rollNumbers}
            onChange={set("rollNumbers")}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Previously assigned students keep their progress. Any new roll numbers entered will be added.
          </p>
        </div>
        <label className="block space-y-1 text-sm font-medium text-slate-700">
          <span className="text-xs font-semibold text-slate-700">Or upload Excel (.xlsx) of additional roll numbers</span>
          <input className="input-field" type="file" accept=".xlsx" onChange={(e) => setRollNumbersFile(e.target.files?.[0] || null)} />
          {rollNumbersFile && <span className="block text-xs text-slate-400">{rollNumbersFile.name}</span>}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary cursor-pointer" onClick={onClose}>Cancel</button>
          <button className="btn-primary cursor-pointer" disabled={busy}>
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StaffTasks({ showAssign, setShowAssign, reloadKey, onReload }) {
  const { user } = useAuth();
  const theme = getPortalTheme(user?.role);
  const { socket } = useSocket();
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(() => api.get("/tasks/assigned").then((r) => setTasks(r.data.tasks)), []);
  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on("task:submission", load);
    socket.on("task:status", load);
    socket.on("unread:refresh", load);
    return () => {
      socket.off("task:submission", load);
      socket.off("task:status", load);
      socket.off("unread:refresh", load);
    };
  }, [socket, load]);

  async function deleteTask(id) {
    if (!confirm("Delete this assignment and all student submissions?")) return;
    await api.delete(`/tasks/${id}`);
    load();
  }

  const shownTasks = tasks.filter((task) => {
    const searchable = `${task.title} ${task.description} ${task.year} ${task.section || ""} ${(task.rollNumbers || []).join(" ")}`.toLowerCase();
    const matchingStudent = task.submissions.some((submission) => `${submission.student?.name || ""} ${submission.student?.rollNumber || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
    return searchable.includes(query.trim().toLowerCase()) || matchingStudent;
  });

  return (
    <div className="space-y-4">
      <label className="relative block max-w-lg">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input-field !pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments, students, or roll numbers" />
      </label>
      {tasks.length === 0 && <EmptyState icon={CheckSquare} title="No assignments created yet" />}
      {tasks.length > 0 && shownTasks.length === 0 && <EmptyState icon={Search} title="No matching assignments or students" />}
      {shownTasks.map((t) => {
        const pct = t.totalCount ? Math.round((t.completedCount / t.totalCount) * 100) : 0;
        const isOverdue = Boolean(t.dueDate && String(t.dueDate).slice(0, 10) < today);
        return (
          <div key={t._id} className="card card-hover !p-4">
            <div className="flex items-center gap-3">
              <Link to={`/app/tasks/${t._id}`} className="flex min-w-0 flex-1 items-center justify-between text-left group">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{t.title}</p>
                    {t.proofRequired && (
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 shrink-0">
                        Proof Compulsory
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Year {t.year}{t.section && ` · Sec ${t.section}`} · {t.completedCount}/{t.totalCount} submitted
                    {t.dueDate && ` · Due ${format(parseISO(String(t.dueDate).slice(0, 10)), "d MMM yyyy")}`}
                    {isOverdue && <span className="text-rose-600 font-semibold ml-1">(Overdue)</span>}
                    {" · View statistics"}
                  </p>
                </div>
                <div className="w-40">
                  <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200/80 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: "var(--portal-primary, #0284c7)",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs font-bold text-slate-600">{pct}%</p>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="btn-ghost !text-slate-600 hover:!text-violet-600 hover:!bg-violet-50 !p-2 cursor-pointer"
                  title="Edit assignment (extend due date, add missed students)"
                  aria-label={`Edit ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTask(t);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="btn-ghost !text-rose-600 hover:!bg-rose-50 !p-2 cursor-pointer"
                  title="Delete assignment"
                  aria-label={`Delete ${t.title}`}
                  onClick={() => deleteTask(t._id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {showAssign && <AssignModal onClose={() => setShowAssign(false)} onDone={() => { setShowAssign(false); load(); if (onReload) onReload(); }} />}
      {editingTask && (
        <EditAssignModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onDone={() => {
            setEditingTask(null);
            load();
            if (onReload) onReload();
          }}
        />
      )}
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const isStaff = ["faculty", "hod", "operator"].includes(user.role);
  const isCoordinator = user.role === "coordinator";
  const [showAssign, setShowAssign] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <Topbar
        title="Assignments"
        subtitle={
          isStaff
            ? "Assign work by year, section or roll number and track submissions."
            : isCoordinator
            ? "Assign work and track your to-do list."
            : "View and submit assignments from your faculty."
        }
      >
        {isStaff && (
          <button className="btn-primary" onClick={() => setShowAssign(true)}>
            <Plus size={16} /> Create assignment
          </button>
        )}
      </Topbar>
      <div className="space-y-6 p-8">
        {isStaff ? (
          <StaffTasks
            showAssign={showAssign}
            setShowAssign={setShowAssign}
            reloadKey={reloadKey}
            onReload={() => setReloadKey((k) => k + 1)}
          />
        ) : isCoordinator ? (
          <>
            <StaffTasks
              showAssign={showAssign}
              setShowAssign={setShowAssign}
              reloadKey={reloadKey}
              onReload={() => setReloadKey((k) => k + 1)}
            />
            <StudentTasks />
          </>
        ) : (
          <StudentTasks />
        )}
      </div>
    </>
  );
}
