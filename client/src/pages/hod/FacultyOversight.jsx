import { useEffect, useMemo, useState } from "react";
import { Users, BookOpen } from "lucide-react";
import api from "../../api/axios";
import Topbar from "../../components/Topbar";
import { Avatar, EmptyState } from "../../components/ui";

export default function FacultyOversight() {
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    api.get("/users", { params: { role: "faculty" } }).then((r) => setFaculty(r.data.users));
    api.get("/subjects").then((r) => setSubjects(r.data.subjects));
  }, []);

  // Build one row per faculty member teaching anything in this branch's subjects,
  // plus home-branch faculty who currently teach nothing here.
  const rows = useMemo(() => {
    const map = new Map();
    faculty.forEach((f) => map.set(f.id, { id: f.id, name: f.name, designation: f.designation, home: f.branch?.code, external: false, load: [] }));
    subjects.forEach((s) =>
      s.assignments.forEach((a) => {
        const fid = a.faculty?._id;
        if (!fid) return;
        if (!map.has(fid)) map.set(fid, { id: fid, name: a.faculty.name, designation: a.faculty.designation, home: null, external: true, load: [] });
        map.get(fid).load.push({ subject: s.name, year: s.year, section: a.section, students: a.studentCount });
      })
    );
    return [...map.values()].sort((a, b) => b.load.length - a.load.length);
  }, [faculty, subjects]);

  return (
    <>
      <Topbar title="Faculty Oversight" subtitle="Who teaches what across your department's subjects." />
      <div className="p-8">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No faculty yet" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => (
              <div key={r.id} className="card">
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-navy-400">{r.designation || "Faculty"}{r.home && ` · ${r.home}`}</p>
                  </div>
                  {r.external && <span className="chip">Visiting from another branch</span>}
                  <span className="chip">{r.load.length} section{r.load.length === 1 ? "" : "s"}</span>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {r.load.length === 0 && <li className="text-sm text-navy-300">Not assigned to any subject yet.</li>}
                  {r.load.map((l, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-navy-50/60 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2"><BookOpen size={14} className="text-navy-500" /> {l.subject}</span>
                      <span className="text-xs text-navy-500">Year {l.year} · Sec {l.section} · {l.students} students</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
