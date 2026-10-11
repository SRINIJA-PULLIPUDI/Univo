import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import { EmptyState } from "../components/ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Timetable() {
  const { user } = useAuth();
  const isStudent = ["student", "coordinator"].includes(user.role);
  const [branches, setBranches] = useState([]);
  const [sel, setSel] = useState({
    branch: user.branch?._id || user.branch || "",
    year: user.year || 3,
    section: user.section || "A",
  });
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!isStudent) api.get("/branches").then((r) => setBranches(r.data.branches));
  }, [isStudent]);

  useEffect(() => {
    if (!sel.branch && !isStudent) return;
    api.get("/timetable", { params: sel }).then((r) => setRows(r.data.timetable));
  }, [sel.branch, sel.year, sel.section, isStudent]);

  const periods = [...new Set(rows.map((r) => r.period))].sort((a, b) => a - b);
  const cell = (day, p) => rows.find((r) => r.day === day && r.period === p);

  return (
    <>
      <Topbar title="Timetable" subtitle="Weekly class schedule by branch, year and section.">
        {!isStudent && (
          <>
            <select className="input-field !w-auto" value={sel.branch} onChange={(e) => setSel({ ...sel, branch: e.target.value })}>
              <option value="">Branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.code}</option>)}
            </select>
            <select className="input-field !w-auto" value={sel.year} onChange={(e) => setSel({ ...sel, year: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
            <input className="input-field !w-20" value={sel.section} onChange={(e) => setSel({ ...sel, section: e.target.value.toUpperCase() })} placeholder="Sec" />
          </>
        )}
      </Topbar>
      <div className="p-8">
        {rows.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No timetable found" subtitle="Ask your HOD to add periods for this section." />
        ) : (
          <div className="card overflow-x-auto !p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700 font-bold border-b border-slate-200/80">
                  <th className="px-4 py-3">Day</th>
                  {periods.map((p) => <th key={p} className="px-4 py-3">Period {p}</th>)}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">{d}</td>
                    {periods.map((p) => {
                      const c = cell(d, p);
                      return (
                        <td key={p} className="px-4 py-3 align-top">
                          {c ? (
                            <>
                              <p className="font-semibold text-slate-900">{c.subject?.name || c.subjectName}</p>
                              <p className="text-xs text-slate-400 font-medium mt-0.5">{c.startTime}-{c.endTime}{c.faculty && ` · ${c.faculty.name}`}</p>
                            </>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
