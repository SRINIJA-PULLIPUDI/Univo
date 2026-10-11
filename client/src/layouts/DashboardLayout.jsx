import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Lock } from "lucide-react";
import Sidebar from "../components/Sidebar";
import AIChatWidget from "../components/AIChatWidget";
import GlobalHeader from "../components/GlobalHeader";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function FirstLoginModal() {
  const { user, setUser } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user?.isFirstLogin) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/auth/first-login-set-password", { newPassword, confirmPassword });
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Could not set new password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700 mb-3">
            <Lock size={22} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Set Your Personal Password</h2>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Welcome to Univo! Since this is your first time signing in, please set a new personal password to secure your account.
          </p>
        </div>
        {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter new password (min. 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn-primary w-full !py-2.5 mt-2" disabled={busy}>
            {busy ? "Setting Password..." : "Save Password & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { user } = useAuth();
  const canUseAi = Boolean(user);
  return (
    <div data-portal={user.role} className="flex h-screen bg-slate-50 text-slate-900 font-body">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <GlobalHeader />
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </main>
      {canUseAi && <AIChatWidget />}
      <FirstLoginModal />
    </div>
  );
}
