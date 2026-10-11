import { useEffect, useState } from "react";
import { BookOpen, User, Users, Plus, Trash2 } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import Topbar from "../../components/Topbar";
import { Modal } from "../../components/ui";

import { getPortalTheme } from "../../utils/portalThemes";

const YEAR_LABEL = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };

function SubjectModal({ initial, defaultYear, onClose, onDone }) {
  const editing = !!initial;
  const initialYear = initial?.year || defaultYear || 1;
  const [form, setForm] = useState({
    name: initial?.name || "",
    code: initial?.code || "",
    year: initialYear,
    semester: initial?.semester || (initialYear * 2 - 1),
  });
  const [busy, setBusy] = useState(false);

  const validSemesters = [form.year * 2 - 1, form.year * 2];

  const handleYearChange = (newYear) => {
    const y = Number(newYear);
    setForm((current) => ({
      ...current,
      year: y,
      semester: y * 2 - 1,
    }));
  };

  const handleSemesterChange = (newSem) => {
    const s = Number(newSem);
    setForm((current) => ({
      ...current,
      semester: s,
      year: Math.ceil(s / 2),
    }));
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = { ...form, year: Number(form.year), semester: Number(form.semester) };
    try {
      if (editing) await api.patch(`/subjects/${initial._id}`, body);
      else await api.post("/subjects", body);
      onDone();
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Delete "${initial.name}" and all its faculty assignments?`)) return;
    await api.delete(`/subjects/${initial._id}`);
    onDone();
  }

  return (
    <Modal title={editing ? "Edit subject" : "Add subject"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className="input-field" placeholder="Subject name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input-field" placeholder="Subject code (e.g. CS301)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Academic Year</label>
            <select
              className="input-field"
              value={form.year}
              onChange={(e) => handleYearChange(e.target.value)}
            >
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>{YEAR_LABEL[y]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Semester</label>
            <select
              className="input-field"
              value={form.semester}
              onChange={(e) => handleSemesterChange(e.target.value)}
            >
              {validSemesters.map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          {editing ? (
            <button type="button" className="btn-ghost !text-red-600 hover:!bg-red-50" onClick={remove}><Trash2 size={15} /> Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{editing ? "Save" : "Add subject"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ReassignModal({ subject, sections, faculty, onClose, onDone }) {
  const [section, setSection] = useState(sections[0]);
  const [facultyId, setFacultyId] = useState("");
  const [busy, setBusy] = useState(false);
  const current = subject.assignments.find((a) => a.section === section);

  useEffect(() => { setFacultyId(current?.faculty?._id || ""); }, [section]);

  async function submit(e) {
    e.preventDefault();
    if (!facultyId) return;
    setBusy(true);
    try {
      await api.post(`/subjects/${subject._id}/assign`, { section, facultyId });
      onDone();
    } finally { setBusy(false); }
  }

  async function unassign() {
    await api.delete(`/subjects/assignments/${current._id}`);
    onDone();
  }

  return (
    <Modal title={`Assign faculty - ${subject.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Section</label>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <button type="button" key={s} onClick={() => setSection(s)}
                className={`rounded-lg border px-4 py-1.5 text-sm font-medium ${section === s ? "border-navy-600 bg-navy-700 text-white" : "border-navy-200 bg-white text-navy-700"}`}>
                Section {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Faculty <span className="font-normal text-navy-400">(any branch)</span></label>
          <select className="input-field" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required>
            <option value="">Select a faculty member</option>
            {faculty.map((f) => (
              <option key={f.id} value={f.id}>{f.name} - {f.branch?.code || "N/A"}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between pt-1">
          {current ? <button type="button" className="btn-ghost !text-red-600 hover:!bg-red-50" onClick={unassign}>Remove assignment</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={busy || !facultyId}>{current ? "Reassign" : "Assign"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function SubjectManagement() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [branch, setBranch] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [semester, setSemester] = useState(0); // 0 = both
  const [subjectModal, setSubjectModal] = useState(null); // {initial?, year?}
  const [reassign, setReassign] = useState(null);

  const load = () => api.get("/subjects").then((r) => setSubjects(r.data.subjects));

  useEffect(() => {
    load();
    api.get("/users/faculty-pool").then((r) => setFaculty(r.data.users));
    api.get("/branches").then((r) => {
      const id = user.branch?._id || user.branch;
      setBranch(r.data.branches.find((b) => b._id === id) || null);
    });
  }, []);

  const theme = getPortalTheme(user?.role);
  const sectionsFor = (year) => branch?.sectionsByYear?.[year] || ["A", "B"];
  const shown = subjects.filter((s) => !semester || s.semester === semester);
  const yearsToShow = semester > 0 ? [Math.ceil(semester / 2)] : [4, 3, 2, 1];

  return (
    <>
      <Topbar title="Subject Management" subtitle={branch ? `${branch.name} Department` : "Your department"}>
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs">
          {[[0, "All"], ...Array.from({ length: 8 }, (_, index) => [index + 1, `Sem ${index + 1}`])].map(([v, l]) => {
            const isSelected = semester === v;
            const yearTag = v > 0 ? ` (${YEAR_LABEL[Math.ceil(v / 2)].replace(" Year", "Y")})` : "";
            return (
              <button key={v} onClick={() => setSemester(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  isSelected ? `${theme.activePill} shadow-sm` : "text-slate-600 hover:bg-slate-50"
                }`}>
                {l}{yearTag}
              </button>
            );
          })}
        </div>
      </Topbar>

      <div className="space-y-6 p-8">
        {yearsToShow.map((year) => {
          const list = shown.filter((s) => s.year === year);
          return (
            <section key={year} className="card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen size={20} className="text-primary" /> {YEAR_LABEL[year]} - Subject Assignments</h2>
                <button className="btn-primary" onClick={() => setSubjectModal({ year })}><Plus size={15} /> Add Subject</button>
              </div>

              {list.length === 0 && <p className="rounded-xl bg-navy-50/60 px-4 py-6 text-center text-sm text-navy-400">No subjects added for this year yet.</p>}

              <div className="space-y-3">
                {list.map((s) => (
                  <div key={s._id} className="flex flex-col gap-3 rounded-xl bg-navy-50/60 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900">{s.name} <span className="ml-1 text-xs font-normal text-navy-400">{s.code} · Sem {s.semester}</span></p>
                      <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-navy-600">
                        {sectionsFor(year).map((sec) => {
                          const a = s.assignments.find((x) => x.section === sec);
                          return a ? (
                            <span key={sec} className="flex items-center gap-1.5">
                              <User size={14} /> <b className="font-semibold">{sec}:</b> {a.faculty?.name}
                              <Users size={14} className="ml-1" /> {a.studentCount} students
                            </span>
                          ) : (
                            <span key={sec} className="text-navy-300"><b className="font-semibold">{sec}:</b> unassigned</span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button className="btn-secondary !py-1.5" onClick={() => setSubjectModal({ initial: s })}>Edit</button>
                      <button className="btn-secondary !py-1.5" onClick={() => setReassign(s)}>Reassign</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {subjectModal && (
        <SubjectModal initial={subjectModal.initial} defaultYear={subjectModal.year}
          onClose={() => setSubjectModal(null)} onDone={() => { setSubjectModal(null); load(); }} />
      )}
      {reassign && (
        <ReassignModal subject={reassign} sections={sectionsFor(reassign.year)} faculty={faculty}
          onClose={() => setReassign(null)} onDone={() => { setReassign(null); load(); }} />
      )}
    </>
  );
}
