import { useState } from "react";
import { BookOpen, GraduationCap, Pencil, Save, Trophy, X, KeyRound, RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";
import { getPortalTheme } from "../utils/portalThemes";

export default function Profile() {
  const { user, setUser } = useAuth();
  const theme = getPortalTheme(user.role);

  // Profile edit
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    bio: user.bio || "",
    skills: (user.skills || []).join(", "),
  });

  // Change Password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Sandy Attendance Sync
  const [syncingSandy, setSyncingSandy] = useState(false);
  const [sandyMsg, setSandyMsg] = useState("");
  const [sandyError, setSandyError] = useState("");

  const isStudent = user.role === "student";
  const canEdit = user.role !== "operator";
  const branchName = user.branch?.name || user.branch?.code || (typeof user.branch === "string" ? user.branch : "Not provided");

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.patch(`/users/${user.id}`, {
        bio: form.bio.trim(),
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      });
      setUser((current) => ({ ...current, ...response.data.user, branch: current.branch }));
      setEditing(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not update your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMsg("");
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const res = await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setPasswordMsg(res.data.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setShowPasswordForm(false), 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Failed to update password. Current password may be incorrect.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleSyncSandy() {
    setSyncingSandy(true);
    setSandyError("");
    setSandyMsg("");
    try {
      const res = await api.post("/users/sync-sandy-attendance", {
        rollNumber: user.rollNumber || "23MH1A05O3",
        password: "Sri12@acoe",
        campus: "ACET",
      });
      setUser(res.data.user);
      setSandyMsg("Live attendance and CGPA synchronized from Sandy portal!");
    } catch (err) {
      setSandyError(err.response?.data?.message || "Could not sync with Sandy attendance portal.");
    } finally {
      setSyncingSandy(false);
    }
  }

  return (
    <>
      <Topbar title={isStudent ? "Student Profile" : "Profile"} subtitle="Manage your academic identity and security settings." />
      <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[320px_1fr]">
        {/* Left Column: Identity Card & Security */}
        <div className="space-y-6">
          <section className="card overflow-hidden !p-0">
            <div className={`h-24 bg-gradient-to-r ${theme.gradient}`} />
            <div className="-mt-12 flex justify-center">
              <div className={`flex h-22 w-22 items-center justify-center rounded-full border-4 border-white ${theme.avatarBg} text-3xl font-extrabold shadow-md`}>
                {user.name.split(/\s+/).map((part) => part[0]).slice(0, 1).join("").toUpperCase()}
              </div>
            </div>
            <div className="space-y-2 px-6 pb-6 pt-3 text-center">
              <h2 className="text-xl font-extrabold text-slate-900">{user.name}</h2>
              <p className={`font-bold text-xs uppercase tracking-wider ${theme.textPrimary}`}>
                {user.rollNumber ? `Roll No: ${user.rollNumber}` : theme.name}
              </p>
              <p className="text-xs font-medium text-slate-500">{branchName}</p>
              <div className="border-t border-slate-100 pt-4 text-left text-xs text-slate-600 space-y-1">
                <p className="truncate"><strong className="text-slate-800">Email:</strong> {user.email}</p>
                {isStudent && (
                  <p><strong className="text-slate-800">Enrollment:</strong> Year {user.year || "-"} · Sem {user.semester || "-"} · Sec {user.section || "-"}</p>
                )}
              </div>
            </div>
          </section>

          {/* Security / Change Password Option */}
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <KeyRound size={16} className={theme.textPrimary} /> Password &amp; Security
              </h3>
              {!showPasswordForm && (
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(true)}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-700 hover:underline"
                >
                  Change Password
                </button>
              )}
            </div>

            {passwordMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 flex items-center gap-1.5 mb-3">
                <CheckCircle2 size={14} /> {passwordMsg}
              </div>
            )}
            {passwordError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 mb-3">
                {passwordError}
              </div>
            )}

            {showPasswordForm ? (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field text-xs !py-1.5"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">New Password (min 6 chars)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field text-xs !py-1.5"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field text-xs !py-1.5"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(false)}
                    className="btn-secondary flex-1 !py-1.5 !text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 !py-1.5 !text-xs"
                    disabled={passwordBusy}
                  >
                    {passwordBusy ? "Updating..." : "Update"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-slate-400">
                Your password can be updated anytime to keep your university account secure.
              </p>
            )}
          </section>

          {isStudent && (
            <section className="card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Trophy size={16} className="text-amber-500" /> Academic Badges
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="chip !bg-emerald-50 !text-emerald-700">75%+ Attendance</span>
                <span className="chip !bg-violet-50 !text-violet-700">Top 10% CGPA</span>
                <span className="chip !bg-blue-50 !text-blue-700">Active Learner</span>
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Academic Standing & Sandy Sync */}
        <div className="space-y-6">
          {isStudent && (
            <section className="card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <GraduationCap size={20} className={theme.textPrimary} /> Academic Standing
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Live academic metrics &amp; attendance</p>
                </div>

                <button
                  type="button"
                  onClick={handleSyncSandy}
                  disabled={syncingSandy}
                  className="btn-secondary !py-1.5 !text-xs flex items-center gap-2 text-violet-700 border-violet-200 hover:bg-violet-50"
                >
                  <RefreshCw size={13} className={syncingSandy ? "animate-spin" : ""} />
                  {syncingSandy ? "Syncing..." : "Sync Portal"}
                </button>
              </div>

              {sandyMsg && (
                <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={14} /> {sandyMsg}
                </div>
              )}
              {sandyError && (
                <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs text-rose-700">
                  {sandyError}
                </div>
              )}

              <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400">Current CGPA</p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {user.cgpa !== null && user.cgpa !== undefined ? `${user.cgpa}` : "—"}
                    <span className="text-xs font-medium text-slate-400"> / 10</span>
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400">Credits Earned</p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {user.creditsEarned ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400">Backlogs</p>
                  <p className={`mt-1 text-2xl font-black ${user.backlogs ? "text-rose-600" : "text-emerald-600"}`}>
                    {user.backlogs ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400">Total Attendance</p>
                  <p className={`mt-1 text-2xl font-black ${(user.totalAttendance || 0) >= 75 ? "text-emerald-600" : "text-rose-600"}`}>
                    {user.totalAttendance !== null && user.totalAttendance !== undefined ? `${user.totalAttendance}%` : "—"}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Skills & Bio Section */}
          <section className="card">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <BookOpen size={18} className={theme.textPrimary} /> Skills &amp; Interests
              </h2>
              {!editing && canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="btn-ghost !py-1 !text-xs flex items-center gap-1"
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
            </div>

            {error && <p role="alert" className="mb-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{error}</p>}

            {editing ? (
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Skills and interests (comma separated)
                  </label>
                  <input
                    className="input-field"
                    value={form.skills}
                    onChange={(event) => setForm({ ...form, skills: event.target.value })}
                    maxLength={500}
                    placeholder="e.g. Python, Deep Learning, React, System Design"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bio</label>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={form.bio}
                    onChange={(event) => setForm({ ...form, bio: event.target.value })}
                    maxLength={1000}
                    placeholder="Write a few lines about yourself..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="btn-secondary !py-2 !text-xs"
                    onClick={() => {
                      setForm({ bio: user.bio || "", skills: (user.skills || []).join(", ") });
                      setEditing(false);
                    }}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button className="btn-primary !py-2 !text-xs" disabled={busy}>
                    <Save size={14} /> {busy ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Skills &amp; Topics</p>
                  {user.skills?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {user.skills.map((skill) => (
                        <span className="chip" key={skill}>{skill}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No skills added yet.</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold text-slate-500 uppercase tracking-wider">Bio</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {user.bio || "Add a short bio to tell faculty and peers about yourself."}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
