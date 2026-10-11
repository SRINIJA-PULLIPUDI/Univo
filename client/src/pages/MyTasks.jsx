import { useEffect, useState } from "react";
import { Check, ListTodo, Pencil, Plus, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import api from "../api/axios";
import Topbar from "../components/Topbar";
import { EmptyState } from "../components/ui";

const EMPTY_FORM = { title: "", description: "", dueDate: "" };

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await api.get("/tasks/personal");
      setTasks(response.data.tasks);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load your personal tasks.");
    }
  }
  useEffect(() => { load(); }, []);

  function startEdit(task) {
    setEditingId(task._id);
    setForm({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (form.dueDate && form.dueDate < format(new Date(), "yyyy-MM-dd")) {
        setError("Please enter today or a later date.");
        return;
      }
      if (editingId) await api.patch(`/tasks/personal/${editingId}`, form);
      else await api.post("/tasks/personal", form);
      closeForm();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not save your task.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task) {
    try {
      await api.patch(`/tasks/personal/${task._id}`, { completed: !task.completed });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update your task.");
    }
  }

  async function remove(task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/personal/${task._id}`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not delete your task.");
    }
  }

  const pending = tasks.filter((task) => !task.completed).length;
  const completed = tasks.length - pending;

  return (
    <>
      <Topbar title="My Tasks & Deadlines" subtitle="Keep track of your personal reminders and study goals.">
        <button type="button" className="btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <Plus size={16} /> New Task
        </button>
      </Topbar>
      {error && !showForm && <p role="alert" className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card min-h-[32rem]">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold"><ListTodo size={19} className="text-violet-600" /> My Tasks</h2>
          {tasks.length === 0 ? (
            <EmptyState icon={ListTodo} title="No personal tasks yet" subtitle="Add a reminder, study goal, or deadline to get started." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <li key={task._id} className="flex items-start gap-3 py-4">
                  <button type="button" aria-label={task.completed ? "Mark task pending" : "Mark task complete"} onClick={() => toggle(task)} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${task.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-violet-500"}`}>
                    <Check size={15} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>{task.title}</p>
                    {task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>}
                    {task.dueDate && <p className="mt-1 text-xs text-slate-400 font-medium">Due {format(parseISO(String(task.dueDate).slice(0, 10)), "d MMM yyyy")}</p>}
                  </div>
                  <button type="button" className="btn-ghost !p-2" aria-label={`Edit ${task.title}`} onClick={() => startEdit(task)}><Pencil size={15} /></button>
                  <button type="button" className="btn-ghost !p-2 !text-rose-600 hover:!bg-rose-50" aria-label={`Delete ${task.title}`} onClick={() => remove(task)}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-5">
          <section className="card space-y-4">
            <h2 className="font-bold text-slate-900">Task Summary</h2>
            <p className="flex justify-between text-sm text-slate-500"><span>Total Pending</span><strong className="text-slate-900">{pending}</strong></p>
            <p className="flex justify-between text-sm text-slate-500"><span>Total Completed</span><strong className="text-emerald-600">{completed}</strong></p>
            <p className="flex justify-between text-sm text-slate-500"><span>All Tasks</span><strong className="text-violet-600">{tasks.length}</strong></p>
          </section>
          <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5">
            <h2 className="font-bold text-violet-900">Productivity Tip</h2>
            <p className="mt-2 text-sm leading-6 text-violet-800">Break large assignments into smaller, manageable study goals and focus on one task at a time.</p>
          </section>
        </aside>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? "Edit personal task" : "Add personal task"}</h2>
              <button type="button" aria-label="Close" onClick={closeForm} className="btn-ghost !p-2"><X size={17} /></button>
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <input className="input-field" maxLength={120} placeholder="Task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <textarea className="input-field" rows={3} maxLength={1000} placeholder="Description (optional)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <label className="block space-y-1 text-sm font-medium"><span>Due date (optional)</span><input className="input-field" type="date" min={format(new Date(), "yyyy-MM-dd")} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : editingId ? "Save changes" : "Add task"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
