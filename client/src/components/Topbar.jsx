export default function Topbar({ title, subtitle, children }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-8 py-5 backdrop-blur-md shadow-2xs">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs font-medium text-slate-500 leading-normal">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
}
