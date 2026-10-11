import { useState } from "react";
import { UploadCloud, X } from "lucide-react";

export function StatCard({ label, value, icon: Icon, hint }) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-400 font-medium">{hint}</p>}
      </div>
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-xs">
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 py-16 text-center shadow-2xs">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 shadow-xs">
          <Icon size={22} />
        </div>
      )}
      <p className="font-bold text-slate-800 text-base">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-xs text-slate-400 font-medium leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export function Avatar({ name, size = 36 }) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white shadow-xs"
    >
      {initials}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100`}>
        <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FileDrop({ file, setFile, accept, label = "Click or drag to choose a file" }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
        dragOver ? "border-sky-500 bg-sky-50/50" : "border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-xs border border-slate-200/80">
        <UploadCloud size={20} />
      </div>
      <span className="text-xs font-semibold text-slate-700">{file ? file.name : label}</span>
      <span className="text-[11px] text-slate-400">PDF, DOC, Images supported</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => setFile(e.target.files[0])}
      />
    </label>
  );
}
