import { useEffect, useMemo, useState } from "react";
import { Edit, Plus, Search, Upload, UserRoundCheck, UserX } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import Topbar from "../../components/Topbar";
import { Avatar, Modal } from "../../components/ui";

const ROLES_FOR = { admin: ["hod", "operator", "faculty", "coordinator", "student"], operator: ["student"], hod: ["operator", "faculty", "student", "coordinator"] };
const ACADEMIC_FIELDS = [
  ["cgpa", "Current CGPA", "number", "0.01", "0", "10"],
  ["creditsEarned", "Credits earned", "number", "1", "0"],
  ["backlogs", "Backlogs", "number", "1", "0"],
  ["totalAttendance", "Total attendance (%)", "number", "0.1", "0", "100"],
];

function AddUserModal({ branches, onClose, onDone }) {
  const { user } = useAuth();
  const roles = ROLES_FOR[user.role];
  const [form, setForm] = useState({
    name: "", email: "", password: "Univo@123", role: roles[0],
    branch: user.role === "admin" ? "" : user.branch?._id || user.branch,
    section: "A", rollNumber: "", semester: 1, designation: "",
    cgpa: "", creditsEarned: "", backlogs: "", totalAttendance: "",
  });
  const [error, setError] = useState("");
  const [bulkImport, setBulkImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isStudentLike = ["student", "coordinator"].includes(form.role);
  const canBulkImport = form.role === "student" || (form.role === "faculty" && user.role === "hod");
  const branchId = form.branch?._id || form.branch;
  const branch = branches.find((item) => item._id === branchId);
  const studentYear = Math.ceil(Number(form.semester) / 2);
  const sections = branch?.sectionsByYear?.[studentYear] || [];

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (canBulkImport && bulkImport) {
      setImportError("");
      if (!importFile) return setImportError("Choose an .xlsx workbook.");
      const data = new FormData();
      data.append("file", importFile);
      const endpoint = form.role === "student" ? "/users/import-students" : "/users/import-faculty";
      if (form.role === "student") {
        data.append("semester", String(form.semester));
        data.append("section", sections.includes(form.section) ? form.section : sections[0] || "");
      }
      setImporting(true);
      try {
        const response = await api.post(endpoint, data);
        const result = response.data;
        alert(`${result.created} ${form.role} accounts created; ${result.skipped.length} duplicate emails skipped${result.invalidRows.length ? `; rows ${result.invalidRows.join(", ")} need correction` : ""}.`);
        onDone();
      } catch (err) {
        setImportError(err.response?.data?.message || `Could not import ${form.role} accounts`);
      } finally {
        setImporting(false);
      }
      return;
    }
    const body = { ...form };
    if (isStudentLike) {
      body.semester = Number(body.semester);
      body.year = Math.ceil(body.semester / 2);
      body.section = sections.includes(body.section) ? body.section : sections[0];
      for (const [field] of ACADEMIC_FIELDS) body[field] = body[field] === "" ? null : Number(body[field]);
    }
    else { delete body.year; delete body.section; delete body.rollNumber; delete body.semester; }
    try {
      await api.post("/users", body);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create user");
    }
  }

  return (
    <Modal title="Add user" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          {!bulkImport && <input className="input-field" placeholder="Full name" value={form.name} onChange={set("name")} required />}
          {!bulkImport && <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />}
          <select className="input-field" value={form.role} onChange={set("role")}>
            {roles.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
          {user.role === "admin" ? (
            <select className="input-field" value={form.branch} onChange={set("branch")} required>
              <option value="">Branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.code}</option>)}
            </select>
          ) : <input className="input-field" disabled value="Your branch" />}
          {!bulkImport && <input className="input-field" placeholder="Temporary password" value={form.password} onChange={set("password")} required minLength={6} />}
          {!isStudentLike && !bulkImport && <input className="input-field" placeholder="Designation" value={form.designation} onChange={set("designation")} />}
        </div>
        {canBulkImport && <>
          <label className="flex items-center gap-2 text-sm font-medium text-navy-700">
            <input type="checkbox" checked={bulkImport} onChange={(e) => setBulkImport(e.target.checked)} />
            Import multiple {form.role === "faculty" ? "faculty" : "students"} from Excel
          </label>
          {bulkImport && <div className="space-y-2">
            <p className="text-xs text-navy-500">Workbook columns must include Name and Email{form.role === "student" ? ", and Roll Number. Section and Semester columns are optional. Optional academic columns: Current CGPA, Credits Earned, Backlogs, Total Attendance." : ". Designation and Password are optional."}</p>
            {importError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</p>}
            <input className="input-field" type="file" accept=".xlsx" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          </div>}
        </>}
        {isStudentLike && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <select className="input-field" value={form.semester} onChange={(e) => {
              const semester = Number(e.target.value);
              const nextYear = Math.ceil(semester / 2);
              const nextSections = branch?.sectionsByYear?.[nextYear] || [];
              setForm({ ...form, semester, section: nextSections.includes(form.section) ? form.section : nextSections[0] || "" });
            }}>{Array.from({ length: 8 }, (_, index) => index + 1).map((sem) => <option key={sem} value={sem}>Semester {sem}</option>)}</select>
            <div className="input-field flex items-center text-navy-600">Year {studentYear}</div>
            <select className="input-field" value={sections.includes(form.section) ? form.section : sections[0] || ""} onChange={set("section")} required>{sections.map((section) => <option key={section} value={section}>Section {section}</option>)}</select>
            {!bulkImport && <input className="input-field" placeholder="Roll number" value={form.rollNumber} onChange={set("rollNumber")} />}
          </div>
        )}
        {isStudentLike && !bulkImport && <div className="grid grid-cols-2 gap-3">
          {ACADEMIC_FIELDS.map(([field, label, type, step, min, max]) => (
            <label key={field} className="space-y-1 text-xs text-navy-500">
              <span>{label}</span>
              <input className="input-field" type={type} step={step} min={min} max={max} value={form[field]} onChange={set(field)} />
            </label>
          ))}
        </div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={importing}>{importing ? "Importing..." : bulkImport ? `Import ${form.role === "faculty" ? "faculty" : "students"}` : "Create user"}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditStudentModal({ student, branches, onClose, onDone }) {
  const [form, setForm] = useState({
    name: student.name,
    email: student.email,
    rollNumber: student.rollNumber || "",
    semester: student.semester || 1,
    section: student.section || "A",
    cgpa: student.cgpa ?? "",
    creditsEarned: student.creditsEarned ?? "",
    backlogs: student.backlogs ?? "",
    totalAttendance: student.totalAttendance ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const branchId = student.branch?._id || student.branch;
  const branch = branches.find((item) => item._id === branchId);
  const year = Math.ceil(Number(form.semester) / 2);
  const sections = branch?.sectionsByYear?.[year] || [];

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { ...form, semester: Number(form.semester), year, section: form.section };
      for (const [field] of ACADEMIC_FIELDS) body[field] = body[field] === "" ? null : Number(body[field]);
      await api.patch(`/users/${student.id}`, body);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit ${student.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input-field" placeholder="Roll number" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <select className="input-field" value={form.semester} onChange={(e) => {
            const semester = Number(e.target.value);
            const nextYear = Math.ceil(semester / 2);
            const nextSections = branch?.sectionsByYear?.[nextYear] || [];
            setForm({ ...form, semester, section: nextSections.includes(form.section) ? form.section : nextSections[0] || "" });
          }}>{Array.from({ length: 8 }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}</select>
          <select className="input-field" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} required>
            {sections.map((section) => <option key={section} value={section}>Section {section}</option>)}
          </select>
        </div>
        <p className="text-xs text-navy-400">Year {year} is determined by semester.</p>
        <div className="grid grid-cols-2 gap-3">
          {ACADEMIC_FIELDS.map(([field, label, type, step, min, max]) => (
            <label key={field} className="space-y-1 text-xs text-navy-500">
              <span>{label}</span>
              <input className="input-field" type={type} step={step} min={min} max={max} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>Save student</button>
        </div>
      </form>
    </Modal>
  );
}

function AcademicImportModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!file) {
      setError("Choose an .xlsx workbook.");
      return;
    }
    setBusy(true);
    setError("");
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await api.post("/users/bulk-academic", data);
      const { updated, invalidRows } = response.data;
      alert(`${updated} students updated${invalidRows.length ? `; rows ${invalidRows.join(", ")} need correction` : ""}.`);
      onDone();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update academic records.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Academic Update" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-navy-600">Use a .xlsx workbook with a Roll Number column and any of Current CGPA, Credits Earned, Backlogs, Total Attendance, or Backlogs Adjustment. Blank cells are left unchanged. Backlogs Adjustment accepts signed increments such as +1 or -1.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <input className="input-field" type="file" accept=".xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Updating..." : "Update records"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [showAcademicImport, setShowAcademicImport] = useState(false);
  const [semester, setSemester] = useState("");
  const [alumni, setAlumni] = useState("false");
  const [selected, setSelected] = useState(new Set());
  const isAdmin = user.role === "admin";
  const canManageStudents = ["operator", "hod"].includes(user.role);

  const load = () => api.get("/users", { params: { role: role || undefined, search: search || undefined, semester: semester || undefined, alumni: role === "student" ? alumni || undefined : undefined } }).then((r) => setUsers(r.data.users));
  useEffect(() => { load(); setSelected(new Set()); }, [role, search, semester, alumni]);
  useEffect(() => { api.get("/branches").then((r) => setBranches(r.data.branches)); }, []);

  const students = useMemo(() => users.filter((candidate) => candidate.role === "student" && !candidate.isAlumni), [users]);
  const allSelected = students.length > 0 && students.every((student) => selected.has(student.id));

  function toggleStudent(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllStudents() {
    setSelected((current) => allSelected ? new Set([...current].filter((id) => !students.some((student) => student.id === id))) : new Set([...current, ...students.map((student) => student.id)]));
  }

  async function advanceSemester() {
    if (!confirm(`Advance ${selected.size} selected students by one semester? Students in semester 8 will be marked as alumni.`)) return;
    const response = await api.post("/users/advance-semester", { userIds: [...selected] });
    alert(`${response.data.advanced} students advanced; ${response.data.graduated} marked as alumni.`);
    setSelected(new Set());
    load();
  }

  async function advanceSemesterCohort() {
    const semesterNumber = Number(semester);
    const action = semesterNumber === 8 ? "mark all semester 8 students as alumni" : `advance every current semester ${semesterNumber} student in this branch`;
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    const response = await api.post("/users/advance-semester", { semester: semesterNumber });
    alert(`${response.data.advanced} students advanced; ${response.data.graduated} marked as alumni.`);
    load();
  }

  async function deactivate(id) {
    if (!confirm("Deactivate this user? They will no longer be able to sign in.")) return;
    await api.delete(`/users/${id}`);
    load();
  }

  return (
    <>
      <Topbar title="Users" subtitle={isAdmin ? "Manage all campus accounts grouped by role across branches." : user.role === "operator" ? "Students in your branch." : "People in your department."}>
        {canManageStudents && <button className="btn-primary" onClick={() => setShowAcademicImport(true)}><Upload size={16} /> Academic Update</button>}
        <button className="btn-primary" onClick={() => setShow(true)}><Plus size={16} /> Add user</button>
      </Topbar>
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-72">
            <Search size={16} className="absolute left-3 top-2.5 text-navy-300" />
            <input className="input-field !pl-10" placeholder="Search by name, email, or roll number" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input-field !w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {(isAdmin ? ["hod", "operator", "faculty", "coordinator", "student"] : user.role === "operator" ? ["student"] : ["operator", "faculty", "coordinator", "student"]).map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
          {!isAdmin && role === "student" && <select className="input-field !w-auto" value={semester} onChange={(e) => setSemester(e.target.value)}><option value="">All semesters</option>{Array.from({ length: 8 }, (_, index) => index + 1).map((sem) => <option key={sem} value={sem}>Semester {sem}</option>)}</select>}
          {!isAdmin && role === "student" && <select className="input-field !w-auto" value={alumni} onChange={(e) => setAlumni(e.target.value)}><option value="false">Current students</option><option value="true">Alumni</option><option value="">All students</option></select>}
        </div>

        {canManageStudents && <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && <button className="btn-primary" onClick={advanceSemester}><UserRoundCheck size={15} /> Advance {selected.size} selected</button>}
          {role === "student" && semester && alumni !== "true" && <button className="btn-secondary" onClick={advanceSemesterCohort}><UserRoundCheck size={15} /> Advance all Semester {semester}</button>}
        </div>}

        {isAdmin ? (
          <div className="space-y-6">
            {[
              { key: "hod", label: "Department HOD Accounts", badge: "HOD", color: "bg-rose-50 text-rose-700 border-rose-200" },
              { key: "operator", label: "Branch Operator Accounts", badge: "Operator", color: "bg-sky-50 text-sky-700 border-sky-200" },
              { key: "faculty", label: "Faculty Accounts", badge: "Faculty", color: "bg-violet-50 text-violet-700 border-violet-200" },
              { key: "coordinator", label: "Student Coordinator Accounts", badge: "Coordinator", color: "bg-amber-50 text-amber-700 border-amber-200" },
              { key: "student", label: "Student Accounts", badge: "Student", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            ]
              .filter((section) => !role || section.key === role)
              .map((section) => {
                const groupUsers = users
                  .filter((u) => u.role === section.key)
                  .sort((a, b) => a.name.localeCompare(b.name));

                return (
                  <section key={section.key} className="card !p-0 overflow-hidden shadow-xs border border-slate-200/80">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${section.color}`}>
                          {section.badge}
                        </span>
                        <h3 className="font-bold text-slate-800 text-sm">{section.label}</h3>
                      </div>
                      <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs">
                        {groupUsers.length} {groupUsers.length === 1 ? "user" : "users"}
                      </span>
                    </div>

                    {groupUsers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No {section.badge} accounts found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white text-left text-xs font-semibold text-slate-500 border-b border-slate-100">
                              <th className="px-5 py-3">Name</th>
                              <th className="px-5 py-3">Branch</th>
                              <th className="px-5 py-3">
                                {["student", "coordinator"].includes(section.key) ? "Year / Sec / Roll" : "Designation"}
                              </th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {groupUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <Avatar name={u.name} />
                                    <div>
                                      <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                                      <p className="text-xs text-slate-400">{u.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="font-semibold text-slate-700">{u.branch?.code || "-"}</span>
                                  {u.branch?.name && <span className="block text-[11px] text-slate-400 truncate max-w-48">{u.branch.name}</span>}
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-600">
                                  {["student", "coordinator"].includes(section.key) ? (
                                    <span>
                                      {u.year ? `Year ${u.year} · Sec ${u.section || "A"}` : "Student"}
                                      {u.rollNumber && <span className="block font-mono text-slate-400">{u.rollNumber}</span>}
                                    </span>
                                  ) : (
                                    <span className="font-medium">{u.designation || "Department Staff"}</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  {u.id !== user.id && (
                                    <button
                                      className="btn-ghost !text-rose-600 hover:!bg-rose-50"
                                      title="Deactivate user"
                                      onClick={() => deactivate(u.id)}
                                    >
                                      <UserX size={15} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
          </div>
        ) : (
          <div className="card overflow-x-auto !p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-50 text-left text-navy-600">
                  {canManageStudents && <th className="px-4 py-3"><input aria-label="Select all visible students" type="checkbox" checked={allSelected} onChange={toggleAllStudents} /></th>}
                  <th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Year / Sec</th><th className="px-4 py-3">Semester</th><th className="px-4 py-3">Roll no.</th><th className="px-4 py-3">CGPA</th><th className="px-4 py-3">Backlogs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-navy-50">
                    {canManageStudents && <td className="px-4 py-3">{u.role === "student" && !u.isAlumni && <input type="checkbox" aria-label={`Select ${u.name}`} checked={selected.has(u.id)} onChange={() => toggleStudent(u.id)} />}</td>}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3"><Avatar name={u.name} /><div><p className="font-semibold">{u.name}</p><p className="text-xs text-navy-400">{u.email}</p></div></div>
                    </td>
                    <td className="px-4 py-3"><span className="chip capitalize">{u.isAlumni ? `Alumni · ${u.passedOutYear || ""}` : u.role}</span></td>
                    <td className="px-4 py-3">{u.branch?.code || "-"}</td>
                    <td className="px-4 py-3">{u.year ? `${u.year} / ${u.section || "-"}` : "-"}</td>
                    <td className="px-4 py-3">{u.semester ? `Sem ${u.semester}` : "-"}</td>
                    <td className="px-4 py-3">{u.rollNumber || "-"}</td>
                    <td className="px-4 py-3">{u.cgpa ?? "-"}</td>
                    <td className="px-4 py-3">{u.backlogs ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {canManageStudents && u.role === "student" && !u.isAlumni && <button className="btn-ghost" aria-label={`Edit ${u.name}`} title="Edit student" onClick={() => setEditingStudent(u)}><Edit size={15} /></button>}
                      {u.id !== user.id && <button className="btn-ghost !text-red-600" onClick={() => deactivate(u.id)}><UserX size={15} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <AddUserModal branches={branches} onClose={() => setShow(false)} onDone={() => { setShow(false); load(); }} />}
      {editingStudent && <EditStudentModal student={editingStudent} branches={branches} onClose={() => setEditingStudent(null)} onDone={() => { setEditingStudent(null); load(); }} />}
      {showAcademicImport && <AcademicImportModal onClose={() => setShowAcademicImport(false)} onDone={() => { setShowAcademicImport(false); load(); }} />}
    </>
  );
}
