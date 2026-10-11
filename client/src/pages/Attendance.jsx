import { useState } from "react";
import { CalendarCheck2, RefreshCw, CheckCircle, AlertTriangle, XCircle, GraduationCap, Clock } from "lucide-react";
import Topbar from "../components/Topbar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function Attendance() {
  const { user, setUser } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [rollNumber, setRollNumber] = useState(user.rollNumber || "23MH1A05O3");
  const [password, setPassword] = useState("Sri12@acoe");
  const [campus, setCampus] = useState("ACET");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncError, setSyncError] = useState("");

  const sandyData = user.sandyAttendanceData;
  const overall = sandyData?.overall?.overall || {
    per: user.totalAttendance || 79.05,
    att: 351,
    held: 444,
  };
  const subjects = sandyData?.overall?.subjects || [
    { subject: "DL (Deep Learning)", held: 61, attended: 44, percentage: 72.13 },
    { subject: "HR&PM (HR & Project Mgmt)", held: 62, attended: 49, percentage: 79.03 },
    { subject: "BCT (Blockchain Tech)", held: 46, attended: 31, percentage: 67.39 },
    { subject: "GAI (Generative AI)", held: 96, attended: 85, percentage: 88.54 },
    { subject: "EM&I (Electronic Measurement)", held: 62, attended: 48, percentage: 77.42 },
    { subject: "OT (Optimization Tech)", held: 49, attended: 41, percentage: 83.67 },
    { subject: "PE-LAB (Project Lab)", held: 41, attended: 35, percentage: 85.37 },
    { subject: "COI (Constitution of India)", held: 27, attended: 18, percentage: 66.67 },
  ];

  const todayData = sandyData?.today?.overall || { held: 7, att: 2, per: 28.57 };
  const yesterdayData = sandyData?.yesterday?.overall || { held: 7, att: 7, per: 100 };

  async function handleSync(e) {
    if (e) e.preventDefault();
    setSyncing(true);
    setSyncError("");
    setSyncMsg("");
    try {
      const res = await api.post("/users/sync-sandy-attendance", {
        rollNumber,
        password,
        campus,
      });
      setUser(res.data.user);
      setSyncMsg(res.data.message || "Attendance synchronized successfully!");
      setTimeout(() => setShowSyncModal(false), 1200);
    } catch (err) {
      setSyncError(err.response?.data?.message || "Failed to sync attendance with Sandy portal.");
    } finally {
      setSyncing(false);
    }
  }

  const isSafe = (overall.per || 0) >= 75;

  return (
    <>
      <Topbar title="My Attendance" subtitle="Live tracking across all subjects synced dynamically.">
        <button
          type="button"
          onClick={() => setShowSyncModal(true)}
          className="btn-primary !py-2 !text-xs flex items-center gap-2"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          Sync Attendance
        </button>
      </Topbar>

      <div className="space-y-6 p-6 max-w-7xl">
        {syncMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle size={18} /> {syncMsg}
          </div>
        )}

        {/* Top Summary Banner */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card !p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Attendance</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isSafe ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {isSafe ? "Eligible" : "Shortage"}
              </span>
            </div>
            <p className={`mt-3 text-4xl font-extrabold ${isSafe ? "text-emerald-600" : "text-rose-600"}`}>
              {overall.per}%
            </p>
            <p className="mt-1 text-xs text-slate-400">Target minimum: 75%</p>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${isSafe ? "bg-emerald-500" : "bg-rose-500"}`}
                style={{ width: `${Math.min(100, overall.per)}%` }}
              />
            </div>
          </div>

          <div className="card !p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Classes Attended</span>
            <p className="mt-3 text-3xl font-extrabold text-slate-900">
              {overall.att} <span className="text-lg font-medium text-slate-400">/ {overall.held}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <CalendarCheck2 size={14} className="text-violet-600" /> Across all academic subjects
            </p>
          </div>

          <div className="card !p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Classes</span>
            <p className="mt-3 text-3xl font-extrabold text-violet-600">
              {todayData.att} <span className="text-lg font-medium text-slate-400">/ {todayData.held}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <Clock size={14} className="text-violet-600" /> Today's attendance: {todayData.per}%
            </p>
          </div>

          <div className="card !p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yesterday's Classes</span>
            <p className="mt-3 text-3xl font-extrabold text-sky-600">
              {yesterdayData.att} <span className="text-lg font-medium text-slate-400">/ {yesterdayData.held}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-600" /> Yesterday's attendance: {yesterdayData.per}%
            </p>
          </div>
        </div>

        {/* Subject-Wise Attendance Breakdown */}
        <section className="card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Subject-Wise Attendance Details</h2>
              <p className="text-xs text-slate-500">Live data synchronized from portal ({campus} campus)</p>
            </div>
            {sandyData?.syncedAt && (
              <span className="text-xs text-slate-400">
                Last synced: {new Date(sandyData.syncedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Subject</th>
                  <th className="pb-3 px-4">Held</th>
                  <th className="pb-3 px-4">Attended</th>
                  <th className="pb-3 px-4">Percentage</th>
                  <th className="pb-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {subjects.map((sub, i) => {
                  const pct = typeof sub.percentage === "number" ? sub.percentage : parseFloat(sub.percentage) || 0;
                  const safe = pct >= 75;
                  const warning = pct >= 65 && pct < 75;

                  return (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 pr-4 font-bold text-slate-800">
                        {sub.subject}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{sub.held}</td>
                      <td className="py-3.5 px-4 text-slate-600">{sub.attended}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${safe ? "text-emerald-600" : warning ? "text-amber-600" : "text-rose-600"}`}>
                            {pct}%
                          </span>
                          <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${safe ? "bg-emerald-500" : warning ? "bg-amber-500" : "bg-rose-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {safe ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            <CheckCircle size={12} /> Safe
                          </span>
                        ) : warning ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                            <AlertTriangle size={12} /> Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                            <XCircle size={12} /> Low
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Sync Sandy Portal Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <GraduationCap size={22} className="text-violet-600" />
                <h3 className="font-bold text-slate-900">Sync Attendance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Connect your credentials to dynamically fetch and sync your real attendance and CGPA records into Univo.
            </p>

            {syncError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700">
                {syncError}
              </div>
            )}
            {syncMsg && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-700">
                {syncMsg}
              </div>
            )}

            <form onSubmit={handleSync} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Campus</label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  className="input-field"
                >
                  <option value="ACET">ACET (Aditya College of Engineering &amp; Tech)</option>
                  <option value="AEC">AEC (Aditya Engineering College)</option>
                  <option value="AUS">AUS (Aditya University)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Roll Number</label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="input-field font-mono font-bold uppercase"
                  placeholder="23MH1A05O3"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Portal Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="btn-secondary flex-1 !py-2.5 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 !py-2.5 !text-xs flex items-center justify-center gap-2"
                  disabled={syncing}
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Connecting..." : "Sync Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
