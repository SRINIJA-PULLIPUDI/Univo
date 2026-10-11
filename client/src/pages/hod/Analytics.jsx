import { useEffect, useState } from "react";
import { Users, BookOpen, CheckSquare, GraduationCap } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import Topbar from "../../components/Topbar";
import { StatCard } from "../../components/ui";

function Bar({ label, value, max, suffix = "" }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-navy-500">{value}{suffix}</span>
      </div>
      <div className="h-2.5 rounded-full bg-navy-100">
        <div className="h-2.5 rounded-full bg-navy-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [branch, setBranch] = useState(null);

  useEffect(() => {
    const branchId = user.branch?._id || user.branch;
    api.get(`/branches/${branchId}/stats`).then((r) => setStats(r.data));
    api.get("/subjects").then((r) => setSubjects(r.data.subjects));
    api.get("/branches").then((r) => setBranch(r.data.branches.find((b) => b._id === branchId)));
  }, []);

  if (!stats || !branch) return <div className="p-8 text-navy-400">Loading analytics...</div>;

  // coverage: how many (subject, section) slots have a faculty assigned
  const coverage = [1, 2, 3, 4].map((y) => {
    const list = subjects.filter((s) => s.year === y);
    const slots = list.reduce((n, s) => n + (branch.sectionsByYear?.[y]?.length || 0), 0);
    const filled = list.reduce((n, s) => n + s.assignments.length, 0);
    return { year: y, subjects: list.length, slots, filled };
  });
  const totalSlots = coverage.reduce((n, c) => n + c.slots, 0);
  const totalFilled = coverage.reduce((n, c) => n + c.filled, 0);
  const maxStudents = Math.max(...Object.values(stats.byYear), 1);

  return (
    <>
      <Topbar title="Analytics" subtitle={`${branch.name} at a glance`} />
      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Students" value={stats.students} icon={GraduationCap} />
          <StatCard label="Faculty" value={stats.faculty} icon={Users} />
          <StatCard label="Subjects" value={subjects.length} icon={BookOpen} />
          <StatCard label="Faculty coverage" value={totalSlots ? `${Math.round((totalFilled / totalSlots) * 100)}%` : "-"} icon={CheckSquare} hint={`${totalFilled} of ${totalSlots} section slots assigned`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-4">
            <h3 className="font-bold">Students by year</h3>
            {[1, 2, 3, 4].map((y) => <Bar key={y} label={`Year ${y}`} value={stats.byYear[y]} max={maxStudents} />)}
          </div>
          <div className="card space-y-4">
            <h3 className="font-bold">Faculty assignment coverage by year</h3>
            {coverage.map((c) => (
              <Bar key={c.year} label={`Year ${c.year} (${c.subjects} subjects)`} value={c.filled} max={c.slots || 1} suffix={` / ${c.slots}`} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
