import { useEffect, useState } from "react";
import { Building2, Edit, Plus, Users, GraduationCap } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import Topbar from "../../components/Topbar";
import { Modal } from "../../components/ui";

const YEARS = [1, 2, 3, 4];

function BranchCard({ branch, onEdit }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get(`/branches/${branch._id}/stats`).then((r) => setStats(r.data)); }, [branch._id]);
  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-700 font-display text-sm font-bold text-white">{branch.code}</div>
        <div className="min-w-0">
          <p className="truncate font-bold">{branch.name}</p>
          <p className="text-xs text-navy-400">HOD: {branch.hod?.name || "Not assigned"}</p>
          <p className="text-xs text-navy-400">Operator: {branch.operator?.name || "Not assigned"}</p>
        </div>
      </div>
      <div className="flex gap-4 text-sm text-navy-600">
        <span className="flex items-center gap-1.5"><GraduationCap size={15} /> {stats?.students ?? "-"} students</span>
        <span className="flex items-center gap-1.5"><Users size={15} /> {stats?.faculty ?? "-"} faculty</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {YEARS.map((y) => (
          <span key={y} className="chip">Y{y}: {(branch.sectionsByYear?.[y] || []).join(", ")}</span>
        ))}
      </div>
      <button className="btn-secondary mt-4 !py-1.5" onClick={() => onEdit(branch)}><Edit size={14} /> Edit</button>
    </div>
  );
}

function BranchModal({ branch, users, isAdmin, onClose, onDone }) {
  const creating = !branch;
  const [form, setForm] = useState({
    name: branch?.name || "",
    code: branch?.code || "",
    hod: branch?.hod?._id || "",
    operator: branch?.operator?._id || "",
    sections: Object.fromEntries(YEARS.map((year) => [year, (branch?.sectionsByYear?.[year] || ["A", "B"]).join(", ")])),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const sectionsByYear = Object.fromEntries(YEARS.map((year) => [
      year,
      form.sections[year].split(",").map((section) => section.trim().toUpperCase()).filter(Boolean),
    ]));
    const body = { sectionsByYear };
    if (isAdmin) Object.assign(body, { name: form.name, code: form.code, hod: form.hod || null, operator: form.operator || null });
    try {
      if (creating) await api.post("/branches", body);
      else await api.patch(`/branches/${branch._id}`, body);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save branch settings");
    } finally {
      setBusy(false);
    }
  }

  const usersForBranch = (role) => users[role].filter((user) => {
    const userBranch = user.branch?._id || user.branch;
    return String(user.id) === String(form[role])
      || String(userBranch || "") === String(branch?._id || "")
      || (role === "operator" && !userBranch);
  });

  return (
    <Modal title={creating ? "Create branch" : `Edit ${branch.code}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {isAdmin && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input-field" placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input-field" placeholder="Branch code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
            {!creating && <>
              <label className="space-y-1 text-sm font-medium">HOD<select className="input-field" value={form.hod} onChange={(e) => setForm({ ...form, hod: e.target.value })}><option value="">Not assigned</option>{usersForBranch("hod").map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
              <label className="space-y-1 text-sm font-medium">Operator<select className="input-field" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}><option value="">Not assigned</option>{usersForBranch("operator").map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            </>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {YEARS.map((year) => (
            <label key={year} className="space-y-1 text-sm font-medium">Year {year} sections
              <input className="input-field" value={form.sections[year]} onChange={(e) => setForm({ ...form, sections: { ...form.sections, [year]: e.target.value } })} placeholder="A, B, C" required />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : creating ? "Create branch" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Branches() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [people, setPeople] = useState({ hod: [], operator: [] });
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/branches").then((r) => setBranches(r.data.branches));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (user.role !== "admin") return;
    Promise.all([api.get("/users", { params: { role: "hod" } }), api.get("/users", { params: { role: "operator" } })])
      .then(([hodResponse, operatorResponse]) => setPeople({ hod: hodResponse.data.users, operator: operatorResponse.data.users }));
  }, [user.role]);

  return (
    <>
      <Topbar title="Branches" subtitle="Departments across the college.">
        {user.role === "admin" && <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Add branch</button>}
      </Topbar>
      <div className="grid gap-4 p-8 md:grid-cols-2 xl:grid-cols-3">
        {branches.map((b) => <BranchCard key={b._id} branch={b} onEdit={setEditing} />)}
        {branches.length === 0 && <p className="text-navy-400"><Building2 className="mb-2" /> No branches yet.</p>}
      </div>
      {showCreate && <BranchModal users={people} isAdmin onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      {editing && <BranchModal branch={editing} users={people} isAdmin={user.role === "admin"} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </>
  );
}
