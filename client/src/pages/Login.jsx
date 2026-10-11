import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Megaphone,
  BookOpen,
  MessageSquare,
  ArrowRight,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";


export default function Login() {
  const { user, setUser, login } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // First time login modal state
  const [firstLoginModal, setFirstLoginModal] = useState(false);
  const [firstNewPassword, setFirstNewPassword] = useState("");
  const [firstConfirmPassword, setFirstConfirmPassword] = useState("");
  const [firstLoginError, setFirstLoginError] = useState("");
  const [firstLoginBusy, setFirstLoginBusy] = useState(false);

  // Forgot password modal state
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter otp + new pass, 3 = success
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    if (user?.isFirstLogin) {
      setFirstLoginModal(true);
    }
  }, [user]);

  if (user && !user.isFirstLogin && !firstLoginModal) {
    return <Navigate to="/app" replace />;
  }


  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.isFirstLogin) {
        setFirstLoginModal(true);
      } else {
        navigate("/app");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFirstLoginSetPassword(e) {
    e.preventDefault();
    setFirstLoginError("");
    if (firstNewPassword.length < 6) {
      setFirstLoginError("Password must be at least 6 characters long.");
      return;
    }
    if (firstNewPassword !== firstConfirmPassword) {
      setFirstLoginError("Passwords do not match.");
      return;
    }
    setFirstLoginBusy(true);
    try {
      const res = await api.post("/auth/first-login-set-password", {
        newPassword: firstNewPassword,
        confirmPassword: firstConfirmPassword,
      });
      setUser(res.data.user);
      setFirstLoginModal(false);
      navigate("/app");
    } catch (err) {
      setFirstLoginError(err.response?.data?.message || "Could not set new password. Please try again.");
    } finally {
      setFirstLoginBusy(false);
    }
  }

  async function handleSendForgotOtp(e) {
    e.preventDefault();
    setForgotError("");
    setForgotBusy(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSuccess(res.data.message);
      setForgotOtp("");
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.message || "Failed to send verification code.");
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setForgotError("");
    if (forgotNewPassword.length < 6) {
      setForgotError("Password must be at least 6 characters long.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotBusy(true);
    try {
      const res = await api.post("/auth/reset-password", {
        email: forgotEmail,
        otp: forgotOtp,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
      });
      setForgotSuccess(res.data.message);
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.response?.data?.message || "Password reset failed. Invalid or expired code.");
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#050C17] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-hidden font-body selection:bg-sky-500 selection:text-white">
      {/* Dynamic Background Ambient Layers */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-gradient-to-br from-[#024B90]/35 via-[#0284C7]/20 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-[#0B3C6D]/40 via-[#03519B]/25 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[35%] h-[350px] w-[350px] rounded-full bg-sky-500/10 blur-[100px] pointer-events-none" />

      {/* Modern High-Tech Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Left Column: Platform Identity & Academic Showcase */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6 pr-0 lg:pr-6">
          {/* Top Block: Logo Badge & Hero Statement */}
          <div className="space-y-6">
            {/* Logo Badge */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#024B90] via-[#0284C7] to-sky-400 text-white shadow-xl shadow-sky-900/40 ring-1 ring-white/20">
                <GraduationCap size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl font-black tracking-tight text-white">Univo</span>
                  <span className="rounded-full bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                    v3.0 Live
                  </span>
                </div>
                <p className="text-xs font-medium text-sky-200/70">Unified Academic Operating System</p>
              </div>
            </div>

            {/* Hero Statement */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 backdrop-blur-md px-3.5 py-1 text-xs font-semibold text-sky-200">
                <Sparkles size={13} className="text-sky-300" />
                Connected Campus Intelligence
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                One connected place for every{" "}
                <span className="bg-gradient-to-r from-sky-300 via-sky-200 to-white bg-clip-text text-transparent">
                  academic conversation.
                </span>
              </h1>
            </div>
          </div>

          {/* 3 Real-Time Portal Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 py-2">
            <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-sky-400/40 hover:bg-white/[0.07] p-4 transition-all duration-300 backdrop-blur-md shadow-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 border border-sky-400/20 mb-3 group-hover:scale-105 transition-transform">
                <Megaphone size={18} />
              </div>
              <h3 className="font-bold text-sm text-white">Announcements</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">Official branch notices broadcasted directly by HOD & Faculty.</p>
            </div>

            <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-sky-400/40 hover:bg-white/[0.07] p-4 transition-all duration-300 backdrop-blur-md shadow-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-400/20 mb-3 group-hover:scale-105 transition-transform">
                <BookOpen size={18} />
              </div>
              <h3 className="font-bold text-sm text-white">Circulars & Notes</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">Instant syllabus, circulars, and study material with live preview.</p>
            </div>

            <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-sky-400/40 hover:bg-white/[0.07] p-4 transition-all duration-300 backdrop-blur-md shadow-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-400/20 mb-3 group-hover:scale-105 transition-transform">
                <MessageSquare size={18} />
              </div>
              <h3 className="font-bold text-sm text-white">Buzz & Forums</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">Active student discussions, events, and collaborative forums.</p>
            </div>
          </div>

          {/* Institutional Trust Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400/80 border-t border-white/[0.08] pt-5">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Aditya University Academic Network
            </span>
            <span className="font-medium text-slate-500">© 2026 Univo Platform • All Rights Reserved</span>
          </div>
        </div>

        {/* Right Column: High-Tech Glass Authentication Terminal */}
        <div className="lg:col-span-5 w-full flex flex-col">
          <div className="relative flex-1 flex flex-col justify-center rounded-3xl bg-gradient-to-b from-[#0B1A30]/90 via-[#071324]/90 to-[#040C18]/95 border border-[#1B365D]/80 backdrop-blur-2xl shadow-2xl shadow-[#020A14]/90 p-7 sm:p-9 overflow-hidden">
            {/* Top Luminous Highlight Bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent" />

            {/* Terminal Header */}
            <div className="space-y-1.5 mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                <Lock size={12} />
                Secure Portal Gateway
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
              <p className="text-xs text-slate-400">Sign in with your institutional credentials to enter.</p>
            </div>


            {/* Error Message */}
            {error && (
              <div className="mb-5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 text-xs font-medium text-rose-300 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Main Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSelectedDemoRole(null);
                    }}
                    required
                    placeholder="e.g. 23mh1a05o3@acoe.edu.in"
                    className="w-full rounded-xl bg-[#050E1C]/80 border border-slate-700/80 px-4 pl-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotModal(true);
                      setForgotStep(1);
                      setForgotEmail(email);
                      setForgotError("");
                      setForgotSuccess("");
                    }}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-[#050E1C]/80 border border-slate-700/80 px-4 pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#024B90] via-[#0269B5] to-[#0284C7] hover:from-[#023E73] hover:to-[#0269B5] text-white py-3 text-sm font-bold shadow-lg shadow-sky-950/60 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 cursor-pointer mt-2"
              >
                {busy ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign in to Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* First-Time Login Modal: Set & Confirm Password */}
      {firstLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#0B1A30] border border-sky-500/30 p-7 sm:p-8 shadow-2xl shadow-black/80 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 border border-sky-400/30 text-sky-400 mb-4">
              <ShieldCheck size={26} />
            </div>
            <h2 className="text-xl font-bold text-white">Welcome to Univo!</h2>
            <p className="mt-1 text-xs text-slate-300/90 leading-relaxed">
              This is your first time signing in. For account security, please configure a new permanent password.
            </p>

            {firstLoginError && (
              <div className="mt-4 rounded-xl bg-rose-500/20 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300">
                {firstLoginError}
              </div>
            )}

            <form onSubmit={handleFirstLoginSetPassword} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">New Password (min 6 chars)</label>
                <input
                  type="password"
                  value={firstNewPassword}
                  onChange={(e) => setFirstNewPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#060F1E] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-hidden"
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={firstConfirmPassword}
                  onChange={(e) => setFirstConfirmPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#060F1E] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-hidden"
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-[#024B90] to-[#0284C7] hover:from-[#023E73] hover:to-[#0269B5] text-white py-2.5 text-sm font-bold shadow-md transition-all mt-2 cursor-pointer"
                disabled={firstLoginBusy}
              >
                {firstLoginBusy ? "Setting Password..." : "Save Password & Continue"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal with OTP */}
      {forgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#0B1A30] border border-sky-500/30 p-7 sm:p-8 shadow-2xl shadow-black/80 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                  <KeyRound size={17} />
                </div>
                <h3 className="font-bold text-white text-base">Reset Your Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setForgotModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {forgotError && (
              <div className="mb-4 rounded-xl bg-rose-500/20 border border-rose-500/30 px-3.5 py-2 text-xs text-rose-300">
                {forgotError}
              </div>
            )}
            {forgotSuccess && forgotStep !== 3 && (
              <div className="mb-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-2 text-xs text-emerald-300">
                {forgotSuccess}
              </div>
            )}

            {forgotStep === 1 && (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <p className="text-xs text-slate-300/80 leading-relaxed">
                  Enter your registered university email. We will send a 6-digit verification code to reset your password.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">University Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-xl bg-[#060F1E] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-hidden"
                    placeholder="e.g. 23mh1a05o3@acoe.edu.in"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-[#024B90] to-[#0284C7] hover:from-[#023E73] hover:to-[#0269B5] text-white py-2.5 text-sm font-bold shadow-md transition-all cursor-pointer"
                  disabled={forgotBusy}
                >
                  {forgotBusy ? "Sending Code..." : "Send Verification Code"}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-300/80 leading-relaxed">
                  Enter the 6-digit code sent to <strong className="text-sky-300">{forgotEmail}</strong> and set your new password.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">6-Digit Verification Code</label>
                  <input
                    type="text"
                    value={forgotOtp}
                    maxLength={6}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    className="w-full rounded-xl bg-[#060F1E] border border-slate-700 px-3.5 py-2.5 text-center font-mono font-bold tracking-widest text-lg text-sky-300 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-hidden"
                    placeholder="123456"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">New Password</label>
                  <input
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="w-full rounded-xl bg-[#060F1E] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-hidden"
                    placeholder="Min 6 characters"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Confirm New Password</label>
                  <input
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="w-full rounded-xl bg-[#060F1E] border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-hidden"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#024B90] to-[#0284C7] hover:from-[#023E73] hover:to-[#0269B5] text-white py-2.5 text-sm font-bold shadow-md transition-all cursor-pointer"
                    disabled={forgotBusy}
                  >
                    {forgotBusy ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 3 && (
              <div className="py-4 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="font-bold text-white text-lg">Password Reset Successfully!</h4>
                <p className="text-xs text-slate-300/80 leading-relaxed">
                  Your password has been updated. You can now sign in using your new credentials.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotModal(false);
                    setPassword("");
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-[#024B90] to-[#0284C7] text-white py-2.5 text-sm font-bold shadow-md transition-all cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
