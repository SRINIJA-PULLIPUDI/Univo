export const PORTAL_THEMES = {
  student: {
    role: "student",
    name: "Student Portal",
    primary: "#7C3AED", // Vibrant Violet / Purple from screenshot
    activePill: "bg-violet-600 text-white shadow-md shadow-violet-600/30",
    gradient: "from-violet-600 to-indigo-600",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    avatarBg: "bg-violet-100 text-violet-700",
    buttonPrimary: "bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-600/20",
    textPrimary: "text-violet-600",
    borderPrimary: "border-violet-500",
    ringPrimary: "focus:ring-violet-400",
    iconBg: "bg-violet-600 text-white",
  },
  hod: {
    role: "hod",
    name: "HOD Portal",
    primary: "#EA580C", // Warm energetic Orange
    activePill: "bg-orange-600 text-white shadow-md shadow-orange-600/30",
    gradient: "from-orange-600 to-amber-600",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    avatarBg: "bg-orange-100 text-orange-700",
    buttonPrimary: "bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-600/20",
    textPrimary: "text-orange-600",
    borderPrimary: "border-orange-500",
    ringPrimary: "focus:ring-orange-400",
    iconBg: "bg-orange-600 text-white",
  },
  faculty: {
    role: "faculty",
    name: "Faculty Portal",
    primary: "#0284C7", // Modern Oceanic Cerulean Blue (no royal blue)
    activePill: "bg-sky-600 text-white shadow-md shadow-sky-600/30",
    gradient: "from-sky-600 to-indigo-700",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    avatarBg: "bg-sky-100 text-sky-700",
    buttonPrimary: "bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20",
    textPrimary: "text-sky-600",
    borderPrimary: "border-sky-500",
    ringPrimary: "focus:ring-sky-400",
    iconBg: "bg-sky-600 text-white",
  },
  operator: {
    role: "operator",
    name: "Operator Portal",
    primary: "#0D9488", // Teal / Emerald
    activePill: "bg-teal-600 text-white shadow-md shadow-teal-600/30",
    gradient: "from-teal-600 to-emerald-600",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    avatarBg: "bg-teal-100 text-teal-700",
    buttonPrimary: "bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/20",
    textPrimary: "text-teal-600",
    borderPrimary: "border-teal-500",
    ringPrimary: "focus:ring-teal-400",
    iconBg: "bg-teal-600 text-white",
  },
  coordinator: {
    role: "coordinator",
    name: "Coordinator Portal",
    primary: "#E11D48", // Rose / Crimson
    activePill: "bg-rose-600 text-white shadow-md shadow-rose-600/30",
    gradient: "from-rose-600 to-pink-600",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    avatarBg: "bg-rose-100 text-rose-700",
    buttonPrimary: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20",
    textPrimary: "text-rose-600",
    borderPrimary: "border-rose-500",
    ringPrimary: "focus:ring-rose-400",
    iconBg: "bg-rose-600 text-white",
  },
  admin: {
    role: "admin",
    name: "Admin Portal",
    primary: "#881337", // Imperial Burgundy / Deep Wine
    activePill: "bg-[#881337] text-white shadow-md shadow-[#881337]/30",
    gradient: "from-[#881337] to-[#4c0519]",
    badge: "bg-rose-50 text-[#881337] border-rose-200",
    avatarBg: "bg-rose-100 text-[#881337]",
    buttonPrimary: "bg-[#881337] hover:bg-[#5f0d26] text-white shadow-sm shadow-[#881337]/20",
    textPrimary: "text-[#881337]",
    borderPrimary: "border-[#881337]",
    ringPrimary: "focus:ring-[#881337]",
    iconBg: "bg-[#881337] text-white",
  },
};

export function getPortalTheme(role) {
  return PORTAL_THEMES[role] || PORTAL_THEMES.student;
}
