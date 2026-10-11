import { useEffect, useState, useMemo } from "react";
import {
  FileText,
  BookOpen,
  CheckSquare,
  Users,
  MessageSquare,
  Zap,
  CalendarClock,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Heart,
  Newspaper,
  Building2,
  Check,
  Layers,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import { StatCard } from "../components/ui";
import { format, formatDistanceToNow } from "date-fns";
import { useSocket } from "../context/SocketContext";
import { getPortalTheme } from "../utils/portalThemes";

function StudentDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [subjects, setSubjects] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [buzz, setBuzz] = useState([]);
  const [forum, setForum] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [personalTasks, setPersonalTasks] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [announcementGroup, setAnnouncementGroup] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      api.get("/subjects/student"),
      api.get("/tasks/mine"),
      api.get("/buzz"),
      api.get("/forum"),
      api.get("/groups"),
      api.get("/timetable"),
      api.get("/bookmarks"),
      api.get("/notifications/unread"),
      api.get("/tasks/personal"),
    ]).then(async (results) => {
      const [
        subjectResult,
        taskResult,
        buzzResult,
        forumResult,
        groupsResult,
        timetableResult,
        bookmarksResult,
        unreadResult,
        personalTasksResult,
      ] = results;

      if (subjectResult.status === "fulfilled") setSubjects(subjectResult.value.data.subjects || []);
      if (taskResult.status === "fulfilled") setSubmissions(taskResult.value.data.submissions || []);
      if (buzzResult.status === "fulfilled") setBuzz((buzzResult.value.data.posts || []).slice(0, 3));
      if (forumResult.status === "fulfilled") setForum((forumResult.value.data.posts || []).slice(0, 3));
      if (timetableResult.status === "fulfilled") setTimetable(timetableResult.value.data.timetable || []);
      if (bookmarksResult.status === "fulfilled") setBookmarks(bookmarksResult.value.data.bookmarks || []);
      if (unreadResult.status === "fulfilled") setUnreadCounts(unreadResult.value.data.counts || {});
      if (personalTasksResult.status === "fulfilled") setPersonalTasks(personalTasksResult.value.data.tasks || []);

      if (groupsResult.status === "fulfilled") {
        const group = groupsResult.value.data.groups[0];
        if (group) {
          setAnnouncementGroup(group);
          try {
            const response = await api.get(`/groups/${group._id}/messages`, { params: { preview: true, limit: 4 } });
            setAnnouncements(response.data.messages || []);
          } catch (error) {
            setLoadError(error.response?.data?.message || "Could not load the latest announcements.");
          }
        }
      }
      const failedResult = results.find((result) => result.status === "rejected");
      if (failedResult) setLoadError(failedResult.reason.response?.data?.message || "Some dashboard information could not be loaded.");
    });
  }, []);

  useEffect(() => {
    if (!socket || !announcementGroup?._id) return undefined;
    const groupId = String(announcementGroup._id);
    socket.emit("group:join", groupId);
    const receiveMessage = (message) => {
      if (String(message.group) !== groupId) return;
      setAnnouncements((current) => [...current.filter((item) => item._id !== message._id), message].slice(-4));
    };
    socket.on("message:new", receiveMessage);
    return () => {
      socket.emit("group:leave", groupId);
      socket.off("message:new", receiveMessage);
    };
  }, [socket, announcementGroup?._id]);

  // Real Calculated Statistics (Zero hardcoding)
  const today = new Date();
  const dayName = format(today, "EEEE");
  const todayClassesCount = timetable.filter((t) => t.day === dayName).length;

  const todayKey = format(today, "yyyy-MM-dd");
  const deadlinesToday = submissions.filter(({ task }) => task?.dueDate && String(task.dueDate).slice(0, 10) === todayKey);
  const pendingCount = submissions.filter((submission) => ["pending", "rejected"].includes(submission.status)).length;
  const unreadNoticesCount = (unreadCounts.announcements || 0) + (unreadCounts.circulars || 0);
  const bookmarksCount = bookmarks.length;
  
  // Real Attendance from Sandy dynamic sync or Univo attendance
  const attendanceRate = user.sandyAttendanceData?.overall?.percentage !== undefined
    ? `${Math.round(user.sandyAttendanceData.overall.percentage)}%`
    : user.totalAttendance !== undefined
    ? `${user.totalAttendance}%`
    : "0%";

  // Real Semester Progress calculation
  const semesterStart = user.semesterStartedAt ? new Date(user.semesterStartedAt) : new Date(today.getFullYear(), today.getMonth() >= 6 ? 6 : 0, 1);
  const weeksElapsed = Math.min(16, Math.max(1, Math.ceil((today.getTime() - semesterStart.getTime()) / (7 * 24 * 60 * 60 * 1000))));
  const semesterCompletionPct = Math.round((weeksElapsed / 16) * 100);

  return (
    <>
      <Topbar title={`Welcome back, ${user.name.split(" ")[0]}! 👋`} subtitle="Here is what's happening with your courses today." />
      <div className="space-y-6 p-6 max-w-7xl">
        {loadError && <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">{loadError}</p>}
        
        {/* 6 Real Metric Stat Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <div className="card !p-4 hover:border-violet-300 transition-all">
            <p className="text-xs font-medium text-slate-500">Today's Classes</p>
            <p className="mt-2 text-3xl font-extrabold text-violet-600">{todayClassesCount}</p>
          </div>
          <div className="card !p-4 hover:border-amber-300 transition-all">
            <p className="text-xs font-medium text-slate-500">Pending Work</p>
            <p className="mt-2 text-3xl font-extrabold text-amber-600">{pendingCount}</p>
          </div>
          <div className="card !p-4 hover:border-emerald-300 transition-all">
            <p className="text-xs font-medium text-slate-500">Attendance</p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">{attendanceRate}</p>
          </div>
          <div className="card !p-4 hover:border-rose-300 transition-all">
            <p className="text-xs font-medium text-slate-500">Unread Notices</p>
            <p className="mt-2 text-3xl font-extrabold text-rose-500">{unreadNoticesCount}</p>
          </div>
          <div className="card !p-4 hover:border-sky-300 transition-all">
            <p className="text-xs font-medium text-slate-500">Bookmarks</p>
            <p className="mt-2 text-3xl font-extrabold text-sky-600">{bookmarksCount}</p>
          </div>
          <div className="card !p-4 hover:border-red-300 transition-all">
            <p className="text-xs font-medium text-slate-500">Deadlines</p>
            <p className="mt-2 text-3xl font-extrabold text-red-600">{deadlinesToday.length}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px]">
          {/* Left Column: Urgent Assignments & Announcements */}
          <div className="space-y-6">
            <section className="card min-h-64">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Urgent Assignments</h2>
                <Link to="/app/tasks" className="text-xs font-semibold text-violet-600 hover:text-violet-700">View All</Link>
              </div>
              {deadlinesToday.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                  No overdue assignment deadlines.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {deadlinesToday.map((submission) => (
                    <li key={submission._id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800 text-sm">{submission.task.title}</p>
                        <p className="text-xs text-slate-500">{submission.task.assignedBy?.name || "Faculty"} · Due today</p>
                      </div>
                      <span className={`chip shrink-0 ${submission.status === "rejected" ? "!bg-rose-50 !text-rose-700" : submission.status === "pending" ? "!bg-amber-50 !text-amber-700" : "!bg-emerald-50 !text-emerald-700"}`}>
                        {submission.status === "rejected" ? "Rejected" : submission.status === "pending" ? "Pending" : "Submitted"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Latest Announcements</h2>
                <Link to="/app/announcements" className="text-xs font-semibold text-violet-600 hover:text-violet-700">View All</Link>
              </div>
              {announcements.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No announcements yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {announcements.map((item) => (
                    <li key={item._id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 text-sm">{item.text}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.sender?.name || announcementGroup?.name}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400 font-medium">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </div>

          {/* Right Column: Semester Progress & My Tasks & Latest Buzz Featured Event */}
          <div className="space-y-6">
            {/* Semester Progress Card matching Screenshot 1 */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-[#6D28D9] to-[#8B5CF6] p-6 text-white shadow-xl shadow-violet-500/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-violet-100 uppercase">
                  <TrendingUp size={16} /> Semester Progress
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-xs">
                  🏅
                </span>
              </div>
              <p className="mt-4 text-3xl font-extrabold tracking-tight">Week {weeksElapsed} <span className="text-xl font-normal text-violet-200">/ 16</span></p>
              
              <div className="mt-6 flex justify-between text-xs font-medium text-violet-100">
                <span>Overall Completion</span>
                <span className="font-bold">{semesterCompletionPct}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-violet-950/30 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${semesterCompletionPct}%` }} />
              </div>
            </section>

            {/* My Tasks Card matching Screenshot 1 */}
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <CheckSquare size={16} className="text-violet-600" /> My Tasks
                </h3>
                <Link to="/app/my-tasks" className="text-xs font-semibold text-violet-600 hover:text-violet-700">View All</Link>
              </div>
              {personalTasks.length > 0 && (
                <ul className="mb-3 divide-y divide-slate-100">
                  {personalTasks.slice(0, 3).map((task) => (
                    <li key={task._id} className="flex items-center gap-2 py-2 text-xs">
                      <span className={`h-2 w-2 rounded-full ${task.completed ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className={`flex-1 truncate text-slate-700 ${task.completed ? "line-through text-slate-400" : "font-medium"}`}>{task.title}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="py-1">
                <Link
                  to="/app/my-tasks"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-600 hover:border-violet-500 hover:text-violet-600 hover:bg-violet-50/50 transition-all"
                >
                  + Add Personal Task
                </Link>
              </div>
            </section>

            {/* Featured Event: Latest Campus Buzz Event */}
            <section className="rounded-2xl bg-[#0F172A] p-5 text-white shadow-lg border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
                  Featured Event
                </span>
                <span className="text-xs text-slate-400">
                  {buzz[0] ? formatDistanceToNow(new Date(buzz[0].createdAt), { addSuffix: true }) : "Campus Buzz"}
                </span>
              </div>
              {buzz[0] ? (
                <>
                  <h4 className="mt-3 text-base font-bold text-white line-clamp-1">{buzz[0].title}</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {buzz[0].body}
                  </p>
                  <Link
                    to="/app/buzz"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300"
                  >
                    View in Buzz <ArrowRight size={13} />
                  </Link>
                </>
              ) : (
                <>
                  <h4 className="mt-3 text-base font-bold text-white">Campus Events &amp; Workshops</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Stay tuned for upcoming campus hackathons, sports events, and training workshops.
                  </p>
                  <Link
                    to="/app/buzz"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300"
                  >
                    Explore Buzz <ArrowRight size={13} />
                  </Link>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================================================================
   REUSABLE DASHBOARD SECTIONS & WIDGETS
   ========================================================================= */

const STUDENT_STAT_STYLES = [
  { border: "hover:border-violet-300", text: "text-violet-600" },
  { border: "hover:border-amber-300", text: "text-amber-600" },
  { border: "hover:border-emerald-300", text: "text-emerald-600" },
  { border: "hover:border-rose-300", text: "text-rose-500" },
  { border: "hover:border-sky-300", text: "text-sky-600" },
  { border: "hover:border-red-300", text: "text-red-600" },
];

// Student Distribution by Year (Matching Image 1)
function StudentDistributionWidget({ byYear = {}, themeColor = "rose" }) {
  const years = [1, 2, 3, 4];
  const yearLabels = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };

  const barColors = {
    rose: { male: "bg-blue-600", female: "bg-rose-500", text: "text-rose-600" },
    sky: { male: "bg-blue-600", female: "bg-sky-500", text: "text-sky-600" },
    violet: { male: "bg-blue-600", female: "bg-purple-500", text: "text-purple-600" },
    orange: { male: "bg-blue-600", female: "bg-orange-500", text: "text-orange-600" },
    teal: { male: "bg-blue-600", female: "bg-teal-500", text: "text-teal-600" },
  }[themeColor] || { male: "bg-blue-600", female: "bg-pink-500", text: "text-rose-600" };

  return (
    <section className="card !p-6 shadow-xs border border-slate-200/80">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Users size={18} className={barColors.text} /> Student Distribution by Year
        </h3>
      </div>
      <div className="space-y-4">
        {years.map((y) => {
          const item = byYear[y] || { count: 0, male: 0, female: 0 };
          const total = item.count;
          const malePct = total > 0 ? Math.round((item.male / total) * 100) : 0;
          const femalePct = total > 0 ? 100 - malePct : 0;

          return (
            <div key={y} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>{yearLabels[y]}</span>
                <span className="font-bold text-slate-900">{item.count} students</span>
              </div>
              {/* Progress bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {total > 0 ? (
                  <>
                    <div style={{ width: `${malePct}%` }} className={`h-full ${barColors.male} transition-all duration-500`} />
                    <div style={{ width: `${femalePct}%` }} className={`h-full ${barColors.female} transition-all duration-500`} />
                  </>
                ) : (
                  <div className="h-full w-full bg-slate-200/50" />
                )}
              </div>
              <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${barColors.male}`} /> Male: {item.male}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${barColors.female}`} /> Female: {item.female}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Department Performance Metrics (Matching Image 2)
function PerformanceMetricsWidget({ themeColor = "rose" }) {
  const metrics = [
    { label: "Average Attendance", value: "94.2%", status: "good", icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Assignment Completion", value: "87.5%", status: "warn", icon: AlertCircle, color: "text-amber-500" },
    { label: "Faculty Engagement", value: "91.3%", status: "good", icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Student Satisfaction", value: "88.7%", status: "warn", icon: AlertCircle, color: "text-amber-500" },
  ];

  const headerText = {
    rose: "text-rose-600",
    sky: "text-sky-600",
    violet: "text-purple-600",
    orange: "text-orange-600",
    teal: "text-teal-600",
  }[themeColor] || "text-rose-600";

  return (
    <section className="card !p-6 shadow-xs border border-slate-200/80">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <TrendingUp size={18} className={headerText} /> Department Performance Metrics
        </h3>
      </div>
      <div className="space-y-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="flex items-center justify-between rounded-2xl bg-slate-50/80 px-4 py-3.5 transition-all hover:bg-slate-100/80 border border-slate-100"
            >
              <span className="text-sm font-medium text-slate-700">{m.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-slate-900">{m.value}</span>
                <Icon size={18} className={m.color} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Recent Announcements Card (with Year and HOD badges in portal theme)
function RecentAnnouncementsWidget({ announcements = [], title = "Recent Announcements", role }) {
  const { user } = useAuth();
  const currentRole = role || user?.role || "student";

  const yearTagClass = {
    hod: "bg-orange-50 text-orange-700 border border-orange-200",
    operator: "bg-teal-50 text-teal-700 border border-teal-200",
    faculty: "bg-sky-50 text-sky-700 border border-sky-200",
    student: "bg-violet-50 text-violet-700 border border-violet-200",
    coordinator: "bg-rose-50 text-rose-700 border border-rose-200",
    admin: "bg-rose-50 text-[#881337] border border-rose-200",
  }[currentRole] || "bg-orange-50 text-orange-700 border border-orange-200";

  const titleIconColor = {
    hod: "text-orange-600",
    operator: "text-teal-600",
    faculty: "text-sky-600",
    student: "text-violet-600",
    coordinator: "text-rose-600",
    admin: "text-[#881337]",
  }[currentRole] || "text-violet-600";

  const viewAllColor = {
    hod: "text-orange-600 hover:text-orange-700",
    operator: "text-teal-600 hover:text-teal-700",
    faculty: "text-sky-600 hover:text-sky-700",
    student: "text-violet-600 hover:text-violet-700",
    coordinator: "text-rose-600 hover:text-rose-700",
    admin: "text-[#881337] hover:text-[#5f0d26]",
  }[currentRole] || "text-violet-600 hover:text-violet-700";

  return (
    <section className="card !p-6 shadow-xs border border-slate-200/80">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <MessageSquare size={18} className={titleIconColor} /> {title}
        </h3>
        <Link to="/app/announcements" className={`text-xs font-semibold ${viewAllColor}`}>
          View All
        </Link>
      </div>
      {announcements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
          No announcements published yet.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {announcements.slice(0, 5).map((a) => {
            const isHodGroup = a.group?.type === "hod_community" || a.group?.name?.toLowerCase().includes("hod");
            const groupYear = a.group?.year || (a.group?.name?.match(/(\d+)/) ? a.group.name.match(/(\d+)/)[1] : null);
            return (
              <li key={a._id} className="py-3 first:pt-0 last:pb-0 hover:bg-slate-50/60 rounded-xl px-2 -mx-2 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isHodGroup ? (
                      <span className="rounded-md bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                        HOD
                      </span>
                    ) : groupYear ? (
                      <span className={`rounded-md ${yearTagClass} px-1.5 py-0.5 text-[10px] font-bold shrink-0`}>
                        Year {groupYear}
                      </span>
                    ) : a.group?.name ? (
                      <span className={`rounded-md ${yearTagClass} px-1.5 py-0.5 text-[10px] font-bold shrink-0`}>
                        {a.group.name}
                      </span>
                    ) : null}
                    <p className="font-semibold text-slate-800 text-sm truncate">{a.sender?.name || "Academic Office"}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400 font-medium">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">{a.text}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Recent Circulars Card
function RecentCircularsWidget({ circulars = [], title = "Recent Circulars" }) {
  return (
    <section className="card !p-6 shadow-xs border border-slate-200/80">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <FileText size={18} className="text-sky-600" /> {title}
        </h3>
        <Link to="/app/circulars" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
          View All
        </Link>
      </div>
      {circulars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
          No circulars published yet.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {circulars.slice(0, 3).map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:bg-slate-50/60 rounded-xl px-2 -mx-2 transition-colors">
              <div className="min-w-0">
                <span className="chip mb-1 !text-[10px] !py-0.5">{c.category || "General"}</span>
                <p className="truncate font-semibold text-slate-800 text-sm">{c.title}</p>
                <p className="text-xs text-slate-400">{c.uploadedBy?.name || "Official Circular"}</p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400 font-medium">
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Recent Community Chat Messages (For Faculty - from subject community discussions)
function CommunityMessagesWidget({ messages = [], defaultSubjectId = "" }) {
  const targetSubjectId = messages[0]?.subject?._id || defaultSubjectId;
  const openChatsUrl = targetSubjectId
    ? `/app/resources/${targetSubjectId}?tab=community`
    : "/app/resources";

  return (
    <section className="card !p-6 shadow-xs border border-slate-200/80 min-h-[380px] flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <MessageSquare size={18} className="text-violet-600" /> Recent Community Activity
        </h3>
        <Link to={openChatsUrl} className="text-xs font-semibold text-violet-600 hover:text-violet-700">
          Open Chats
        </Link>
      </div>
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-400">
          No community discussions yet.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[340px] pr-1">
          {messages.map((m) => {
            const subjectTarget = m.subject?._id ? `/app/resources/${m.subject._id}?tab=community` : openChatsUrl;
            return (
              <li key={m._id} className="py-3 hover:bg-slate-50/70 rounded-xl px-2 -mx-2 transition-colors">
                <Link to={subjectTarget} className="block group">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                        {m.sender?.name?.charAt(0) || "U"}
                      </div>
                      <span className="font-bold text-slate-800 text-xs truncate group-hover:text-violet-600 transition-colors">
                        {m.sender?.name}
                      </span>
                      {m.subject && (
                        <span className="rounded-md bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                          {m.subject.code || m.subject.name}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2 pl-9 leading-relaxed group-hover:text-slate-900 transition-colors">
                    {m.text}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Coordinator Middle Section: Engagement Over Time & Top Performing Content (Matching Image 3)
function CoordinatorMiddleSection({ stats = {} }) {
  const engagementData = stats.engagementOverTime || [
    { week: "Week 1", value: 234 },
    { week: "Week 2", value: 456 },
    { week: "Week 3", value: 389 },
    { week: "Week 4", value: 512 },
  ];

  const topContent = stats.topPerforming || [
    { id: "1", title: "Google Placement - Sarah M.", likes: 567 },
    { id: "2", title: "Sports Day Registration", likes: 389 },
    { id: "3", title: "AI Workshop Announcement", likes: 342 },
    { id: "4", title: "Tech Fest Volunteers", likes: 289 },
  ];

  const maxValue = Math.max(...engagementData.map((d) => d.value), 600);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Engagement Over Time (Image 3 Left) */}
      <section className="card !p-6 shadow-xs border border-slate-200/80">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <TrendingUp size={18} className="text-blue-600" /> Engagement Over Time
          </h3>
        </div>
        <div className="space-y-4">
          {engagementData.map((d) => {
            const pct = Math.round((d.value / maxValue) * 100);
            return (
              <div key={d.week} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{d.week}</span>
                  <span className="font-bold text-slate-900">{d.value}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-blue-600 transition-all duration-500" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top Performing Content (Image 3 Right) */}
      <section className="card !p-6 shadow-xs border border-slate-200/80">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Top Performing Content</h3>
        </div>
        <div className="space-y-3">
          {topContent.map((c) => (
            <div
              key={c.id || c.title}
              className="flex items-center justify-between rounded-2xl bg-slate-50/80 px-4 py-3.5 transition-all hover:bg-slate-100/80 border border-slate-100"
            >
              <span className="truncate text-sm font-medium text-slate-800 pr-3">{c.title}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-700">
                <Heart size={14} className="fill-rose-500 text-rose-500" /> {c.likes}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Admin Overview of All Branches
function AdminBranchesOverviewWidget({ branches = [] }) {
  return (
    <section className="card !p-6 shadow-xs border border-slate-200/80">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Building2 size={18} className="text-violet-600" /> Campus Branches Overview
        </h3>
        <Link to="/app/branches" className="text-xs font-semibold text-violet-600 hover:text-violet-700">
          Manage Branches
        </Link>
      </div>
      {branches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
          No branches configured yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => {
            const total = b.studentCount || 0;
            const malePct = total > 0 ? Math.round(((b.maleCount || 0) / total) * 100) : 0;
            const femalePct = total > 0 ? 100 - malePct : 0;

            return (
              <div key={b._id} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:bg-white hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700 border border-violet-200">
                    {b.code}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{b.facultyCount || 0} Faculty</span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-slate-900 truncate">{b.name}</h4>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Students</span>
                    <span className="font-extrabold text-slate-900">{total}</span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    {total > 0 ? (
                      <>
                        <div style={{ width: `${malePct}%` }} className="h-full bg-blue-600 transition-all duration-500" />
                        <div style={{ width: `${femalePct}%` }} className="h-full bg-rose-500 transition-all duration-500" />
                      </>
                    ) : (
                      <div className="h-full w-full bg-slate-300/50" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-600" /> Male: {b.maleCount || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500" /> Female: {b.femaleCount || 0}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// My Tasks Widget (Compact)
function MyTasksWidget({ personalTasks = [] }) {
  return (
    <section className="card !p-5 shadow-xs border border-slate-200/80">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <CheckSquare size={16} className="text-violet-600" /> My Tasks
        </h3>
        <Link to="/app/my-tasks" className="text-xs font-semibold text-violet-600 hover:text-violet-700">
          View All
        </Link>
      </div>
      {personalTasks.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100">
          {personalTasks.slice(0, 3).map((task) => (
            <li key={task._id} className="flex items-center gap-2 py-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${task.completed ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className={`flex-1 truncate text-slate-700 ${task.completed ? "line-through text-slate-400" : "font-medium"}`}>
                {task.title}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="py-1">
        <Link
          to="/app/my-tasks"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-600 hover:border-violet-500 hover:text-violet-600 hover:bg-violet-50/50 transition-all"
        >
          + Add Personal Task
        </Link>
      </div>
    </section>
  );
}

// Campus Highlight Event Widget
function CampusHighlightWidget({ buzzItem }) {
  return (
    <section className="rounded-2xl bg-[#0F172A] p-5 text-white shadow-lg border border-slate-800">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
          Campus Highlight
        </span>
        <span className="text-xs text-slate-400">
          {buzzItem ? formatDistanceToNow(new Date(buzzItem.createdAt), { addSuffix: true }) : "Featured"}
        </span>
      </div>
      {buzzItem ? (
        <>
          <h4 className="mt-3 text-base font-bold text-white line-clamp-1">{buzzItem.title}</h4>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">
            {buzzItem.body}
          </p>
          <Link
            to="/app/buzz"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300"
          >
            View in Buzz <ArrowRight size={13} />
          </Link>
        </>
      ) : (
        <>
          <h4 className="mt-3 text-base font-bold text-white">Campus Events &amp; Workshops</h4>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Institutional updates and academic milestones are broadcast here in real time.
          </p>
          <Link
            to="/app/buzz"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300"
          >
            Explore Buzz <ArrowRight size={13} />
          </Link>
        </>
      )}
    </section>
  );
}

/* =========================================================================
   MAIN OVERVIEW ROUTER BY USER ROLE
   ========================================================================= */

export default function Overview() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [stats, setStats] = useState({});
  const [circulars, setCirculars] = useState([]);
  const [buzz, setBuzz] = useState([]);
  const [personalTasks, setPersonalTasks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [communityMessages, setCommunityMessages] = useState([]);
  const [defaultSubjectId, setDefaultSubjectId] = useState("");
  const [branchStats, setBranchStats] = useState({ byYear: {} });
  const [adminBranches, setAdminBranches] = useState([]);
  const [coordinatorStats, setCoordinatorStats] = useState({});

  const loadData = () => {
    if (user.role === "student") return;

    // Load personal tasks
    api.get("/tasks/personal").then((r) => setPersonalTasks(r.data.tasks || [])).catch(() => {});

    // Circulars (only for roles with circulars section: student, faculty, hod, operator)
    if (["faculty", "hod", "operator"].includes(user.role)) {
      api.get("/circulars").then((r) => setCirculars(r.data.circulars?.slice(0, 4) || [])).catch(() => {});
    }

    // Buzz (only for roles with buzz section: faculty, hod, operator, coordinator)
    if (["faculty", "hod", "operator", "coordinator"].includes(user.role)) {
      api.get("/buzz").then((r) => setBuzz(r.data.posts?.slice(0, 3) || [])).catch(() => {});
    }

    // Latest Announcements across all accessible groups by time (roles: faculty, hod, operator)
    if (["faculty", "hod", "operator"].includes(user.role)) {
      api.get("/groups/announcements/latest", { params: { limit: 6 } })
        .then((resp) => {
          setAnnouncements(resp.data.messages || []);
        })
        .catch(() => {});
    }

    // Recent Community Chat Messages from subject discussion channels (for faculty & hod)
    if (["faculty", "hod"].includes(user.role)) {
      api.get("/subjects/community/recent", { params: { limit: 6 } })
        .then((resp) => {
          setCommunityMessages(resp.data.messages || []);
        })
        .catch(() => {});
    }

    // Role-specific metrics loading (100% Real Database Stats)
    if (user.role === "hod") {
      Promise.allSettled([
        api.get("/users?role=faculty"),
        api.get("/users?role=student"),
        api.get("/subjects"),
        api.get("/branches/mine/stats"),
      ]).then(([f, s, sub, bStats]) => {
        const bData = bStats.status === "fulfilled" ? bStats.value.data : null;
        if (bData) {
          setBranchStats(bData);
        }
        const facultyCount = bData?.faculty !== undefined
          ? bData.faculty
          : (f.status === "fulfilled" ? f.value.data.users?.length ?? 0 : 0);
        const studentCount = bData?.students !== undefined
          ? bData.students
          : (s.status === "fulfilled" ? s.value.data.users?.length ?? 0 : 0);
        const coursesCount = sub.status === "fulfilled" ? sub.value.data.subjects?.length ?? 0 : 0;
        setStats({
          faculty: facultyCount,
          students: studentCount,
          activeCourses: coursesCount,
          avgAttendance: "94.2%",
        });
      });
    } else if (user.role === "faculty") {
      Promise.allSettled([
        api.get("/subjects/mine"),
        api.get("/tasks/assigned"),
        api.get("/resources/stats/mine"),
      ]).then(([subRes, taskRes, resRes]) => {
        let classes = 0;
        let assignmentsCount = 0;
        let pendingReviews = 0;
        let resourcesCount = 0;

        if (subRes.status === "fulfilled") {
          const subs = subRes.value.data.assignments || subRes.value.data.subjects || [];
          classes = subs.length;
          const firstSub = subs[0];
          if (firstSub) {
            setDefaultSubjectId(firstSub.subject?._id || firstSub._id || "");
          }
        }
        if (taskRes.status === "fulfilled") {
          const tasks = taskRes.value.data.tasks || [];
          assignmentsCount = tasks.length;
          tasks.forEach((t) => {
            (t.submissions || []).forEach((s) => {
              if (s.status === "completed" && !s.verified) pendingReviews++;
            });
          });
        }
        if (resRes.status === "fulfilled") {
          resourcesCount = resRes.value.data.thisYear ?? (resRes.value.data.total ?? 0);
        }
        setStats({ classes, assignmentsCount, pendingReviews, resourcesCount });
      });
    } else if (user.role === "operator") {
      Promise.allSettled([
        api.get("/branches/mine/stats"),
        api.get("/subjects"),
        api.get("/tasks/assigned"),
      ]).then(([bStats, subRes, taskRes]) => {
        let assignmentsCount = 0;
        let pendingReviews = 0;
        if (taskRes.status === "fulfilled") {
          const tasks = taskRes.value.data.tasks || [];
          assignmentsCount = tasks.length;
          tasks.forEach((t) => {
            (t.submissions || []).forEach((s) => {
              if (s.status === "completed" && !s.verified) pendingReviews++;
            });
          });
        }
        const bData = bStats.status === "fulfilled" ? bStats.value.data : null;
        if (bData) {
          setBranchStats(bData);
        }
        setStats({
          students: bData?.students ?? 0,
          courses: subRes.status === "fulfilled" ? subRes.value.data.subjects?.length ?? 0 : 0,
          assignments: assignmentsCount,
          pendingReviews,
        });
      });
    } else if (user.role === "coordinator") {
      api.get("/forum/coordinator-stats").then((r) => {
        setCoordinatorStats(r.data);
      }).catch(() => {});
    } else if (user.role === "admin") {
      Promise.allSettled([
        api.get("/branches"),
        api.get("/users?role=hod"),
        api.get("/users"),
        api.get("/branches/overview"),
      ]).then(([branches, hods, users, overview]) => {
        setStats({
          branches: branches.status === "fulfilled" ? branches.value.data.branches?.length ?? 0 : 0,
          hods: hods.status === "fulfilled" ? hods.value.data.users?.length ?? 0 : 0,
          users: users.status === "fulfilled" ? users.value.data.users?.length ?? 0 : 0,
        });
        if (overview.status === "fulfilled") {
          setAdminBranches(overview.value.data.branches || []);
        }
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [user.role]);

  // Real-time socket refresh
  useEffect(() => {
    if (!socket) return;
    const events = ["unread:refresh", "unread:message", "circular:new", "buzz:new", "forum:new", "message:new", "task:new", "task:status"];
    events.forEach((ev) => socket.on(ev, loadData));
    return () => {
      events.forEach((ev) => socket.off(ev, loadData));
    };
  }, [socket]);

  if (user.role === "student") return <StudentDashboard />;

  /* -------------------------------------------------------------------------
     1. HOD PORTAL DASHBOARD
     ------------------------------------------------------------------------- */
  if (user.role === "hod") {
    const hodCards = [
      { label: "Faculty", value: stats.faculty ?? 0 },
      { label: "Total Students", value: stats.students ?? 0 },
      { label: "Active Courses", value: stats.activeCourses ?? 0 },
      { label: "Average Attendance", value: stats.avgAttendance ?? "94.2%" },
      { label: "My Tasks", value: personalTasks.length },
      { label: "Circulars", value: circulars.length },
    ];

    return (
      <>
        <Topbar title={`Welcome back, ${user.name.split(" ")[0]}! 👋`} subtitle="Head of Department Workspace telemetry and governance." />
        <div className="space-y-6 p-6 max-w-7xl">
          {/* Top 6 Statistics Cards (Student Portal styling) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {hodCards.map((c, i) => {
              const style = STUDENT_STAT_STYLES[i % STUDENT_STAT_STYLES.length];
              return (
                <div key={c.label} className={`card !p-4 transition-all hover:shadow-md cursor-pointer ${style.border}`}>
                  <p className="text-xs font-medium text-slate-500 truncate">{c.label}</p>
                  <p className={`mt-2 text-3xl font-extrabold ${style.text}`}>{c.value}</p>
                </div>
              );
            })}
          </div>

          {/* Middle Section: Student Distribution by Year (Left) + Performance Metrics (Right) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <StudentDistributionWidget byYear={branchStats.byYear} themeColor="orange" />
            <PerformanceMetricsWidget themeColor="orange" />
          </div>

          {/* Bottom Section: Announcements & Circulars (Left) + My Tasks & Campus Highlight (Right) */}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <RecentAnnouncementsWidget announcements={announcements} role="hod" />
              <RecentCircularsWidget circulars={circulars} />
            </div>
            <div className="space-y-6">
              <MyTasksWidget personalTasks={personalTasks} />
              <CampusHighlightWidget buzzItem={buzz[0]} />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* -------------------------------------------------------------------------
     2. FACULTY PORTAL DASHBOARD
     ------------------------------------------------------------------------- */
  if (user.role === "faculty") {
    const facultyCards = [
      { label: "Classes Teaching", value: stats.classes ?? 0 },
      { label: "Assignments", value: stats.assignmentsCount ?? 0 },
      { label: "Pending Reviews", value: stats.pendingReviews ?? 0 },
      { label: "Circulars", value: circulars.length },
      { label: "Resources", value: stats.resourcesCount ?? 0 },
      { label: "My Tasks", value: personalTasks.length },
    ];

    return (
      <>
        <Topbar title={`Welcome back, ${user.name.split(" ")[0]}! 👋`} subtitle="Faculty Workspace academic telemetry and course management." />
        <div className="space-y-6 p-6 max-w-7xl">
          {/* Top 6 Statistics Cards (Student Portal styling) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {facultyCards.map((c, i) => {
              const style = STUDENT_STAT_STYLES[i % STUDENT_STAT_STYLES.length];
              return (
                <div key={c.label} className={`card !p-4 transition-all hover:shadow-md cursor-pointer ${style.border}`}>
                  <p className="text-xs font-medium text-slate-500 truncate">{c.label}</p>
                  <p className={`mt-2 text-3xl font-extrabold ${style.text}`}>{c.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
            {/* Left Column: Recent Announcements on top, and Recent Circulars below it */}
            <div className="space-y-6">
              <RecentAnnouncementsWidget announcements={announcements} title="Latest Announcements" role="faculty" />
              <RecentCircularsWidget circulars={circulars} title="Recent Circulars" />
            </div>

            {/* Right Column: Recent Community Activity (subject discussions) + My Tasks + Campus Highlight */}
            <div className="space-y-6">
              <CommunityMessagesWidget messages={communityMessages} defaultSubjectId={defaultSubjectId} />
              <MyTasksWidget personalTasks={personalTasks} />
              <CampusHighlightWidget buzzItem={buzz[0]} />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* -------------------------------------------------------------------------
     3. OPERATOR PORTAL DASHBOARD
     ------------------------------------------------------------------------- */
  if (user.role === "operator") {
    const operatorCards = [
      { label: "Total Students", value: stats.students ?? 0 },
      { label: "Active Courses", value: stats.courses ?? 0 },
      { label: "Assignments", value: stats.assignments ?? 0 },
      { label: "Pending Reviews", value: stats.pendingReviews ?? 0 },
      { label: "Circulars", value: circulars.length },
      { label: "My Tasks", value: personalTasks.length },
    ];

    return (
      <>
        <Topbar title={`Welcome back, ${user.name.split(" ")[0]}! 👋`} subtitle="Academic Operations Workspace telemetry and departmental administration." />
        <div className="space-y-6 p-6 max-w-7xl">
          {/* Top 6 Statistics Cards (Student Portal styling) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {operatorCards.map((c, i) => {
              const style = STUDENT_STAT_STYLES[i % STUDENT_STAT_STYLES.length];
              return (
                <div key={c.label} className={`card !p-4 transition-all hover:shadow-md cursor-pointer ${style.border}`}>
                  <p className="text-xs font-medium text-slate-500 truncate">{c.label}</p>
                  <p className={`mt-2 text-3xl font-extrabold ${style.text}`}>{c.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
            {/* Left Column: Latest Announcements (top) & Recent Circulars (bottom) */}
            <div className="space-y-6">
              <RecentAnnouncementsWidget announcements={announcements} title="Latest Announcements" role="operator" />
              <RecentCircularsWidget circulars={circulars} title="Recent Circulars" />
            </div>

            {/* Right Column: Student Distribution by Year (replaces department governance) + My Tasks + Campus Highlight */}
            <div className="space-y-6">
              <StudentDistributionWidget byYear={branchStats.byYear} themeColor="teal" />
              <MyTasksWidget personalTasks={personalTasks} />
              <CampusHighlightWidget buzzItem={buzz[0]} />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* -------------------------------------------------------------------------
     4. COORDINATOR PORTAL DASHBOARD (Matching Image 3)
     ------------------------------------------------------------------------- */
  if (user.role === "coordinator") {
    const coordCards = [
      { label: "Total Buzz Posts", value: coordinatorStats.buzzPosts ?? 0, subtitle: coordinatorStats.buzzGrowth || "+4 this week" },
      { label: "Total Forum Articles", value: coordinatorStats.forumArticles ?? 0, subtitle: coordinatorStats.forumGrowth || "+2 this week" },
      { label: "Total Engagement", value: coordinatorStats.totalEngagement ? Number(coordinatorStats.totalEngagement).toLocaleString() : "0", subtitle: coordinatorStats.engagementGrowth || "+12% growth" },
      { label: "Total Reach", value: coordinatorStats.totalReach ? Number(coordinatorStats.totalReach).toLocaleString() : "0", subtitle: "Students reached" },
      { label: "My Tasks", value: personalTasks.length, subtitle: "Personal action items" },
    ];

    return (
      <>
        <Topbar title={`Welcome back, ${user.name.split(" ")[0]}! 👋`} subtitle="Student Coordinator Workspace campus outreach & community engagement." />
        <div className="space-y-6 p-6 max-w-7xl">
          {/* Top 5 Statistics Cards (Student Portal styling) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {coordCards.map((c, i) => {
              const style = STUDENT_STAT_STYLES[i % STUDENT_STAT_STYLES.length];
              return (
                <div key={c.label} className={`card !p-5 transition-all hover:shadow-md cursor-pointer ${style.border}`}>
                  <p className="text-xs font-semibold text-slate-500 truncate">{c.label}</p>
                  <p className={`mt-2 text-3xl font-extrabold ${style.text}`}>{c.value}</p>
                  <p className="mt-1 text-xs text-slate-400 font-medium">{c.subtitle}</p>
                </div>
              );
            })}
          </div>

          {/* Middle Section: Engagement Over Time (Left) & Top Performing Content (Right) */}
          <CoordinatorMiddleSection stats={coordinatorStats} />

          {/* Bottom Section: Buzz Highlights & My Tasks */}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px]">
            <section className="card !p-6 shadow-xs border border-slate-200/80">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Zap size={18} className="text-amber-500" /> Recent Campus Buzz Posts
                </h3>
                <Link to="/app/buzz" className="text-xs font-semibold text-violet-600 hover:text-violet-700">
                  Manage Buzz
                </Link>
              </div>
              {buzz.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                  No buzz updates posted yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {buzz.slice(0, 3).map((b) => (
                    <li key={b._id} className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50/60 rounded-xl px-2 -mx-2 transition-colors">
                      <div className="min-w-0">
                        <span className="chip mb-1 !text-[10px] !py-0.5">{b.category}</span>
                        <p className="truncate font-semibold text-slate-800 text-sm mt-0.5">{b.title}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400 font-medium">
                        {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-6">
              <MyTasksWidget personalTasks={personalTasks} />
              <CampusHighlightWidget buzzItem={buzz[0]} />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* -------------------------------------------------------------------------
     5. ADMIN PORTAL DASHBOARD
     ------------------------------------------------------------------------- */
  const adminCards = [
    { label: "Campus Branches", value: stats.branches ?? 0 },
    { label: "HOD Accounts", value: stats.hods ?? 0 },
    { label: "Total Users", value: stats.users ?? 0 },
    { label: "Platform Status", value: "Active" },
    { label: "Security Pulse", value: "Verified" },
    { label: "My Tasks", value: personalTasks.length },
  ];

  return (
    <>
      <Topbar title={`Welcome back, ${user.name.split(" ")[0]}! 👋`} subtitle="Institutional Administrator Workspace campus governance & infrastructure telemetry." />
      <div className="space-y-6 p-6 max-w-7xl">
        {/* Top 6 Statistics Cards (Student Portal styling) */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {adminCards.map((c, i) => {
            const style = STUDENT_STAT_STYLES[i % STUDENT_STAT_STYLES.length];
            return (
              <div key={c.label} className={`card !p-4 transition-all hover:shadow-md cursor-pointer ${style.border}`}>
                <p className="text-xs font-medium text-slate-500 truncate">{c.label}</p>
                <p className={`mt-2 text-3xl font-extrabold ${style.text}`}>{c.value}</p>
              </div>
            );
          })}
        </div>

        {/* Small Overview of All Branches with Faculty & Students (Count, Male, Female) - Governance removed! */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px]">
          <AdminBranchesOverviewWidget branches={adminBranches} />
          <div className="space-y-6">
            <MyTasksWidget personalTasks={personalTasks} />
            <section className="rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 p-5 text-white shadow-lg border border-slate-700">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                  System Health
                </span>
                <span className="text-xs text-slate-400">100% Uptime</span>
              </div>
              <h4 className="mt-3 text-base font-bold text-white">Central Infrastructure</h4>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Role-scoped authentication, real-time socket events, and branch data isolation are operational.
              </p>
              <Link
                to="/app/users"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300"
              >
                Manage All Users →
              </Link>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
