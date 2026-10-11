/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Single navy-blue family, derived from the Aditya University mark's
        // ring/sun-outline blue. No orange anywhere in the product per the brief.
        navy: {
          50: "#eef2fb",
          100: "#dbe4f5",
          200: "#b3c7e8",
          300: "#82a4d8",
          400: "#5580c4",
          500: "#3762aa",
          600: "#274a89",
          700: "#1e3a6f",
          800: "#152a52",
          900: "#0d1c39",
          950: "#070f21",
        },
        ink: "#0d1c39",
        surface: "#f6f8fd",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(13,28,57,0.06), 0 8px 24px -12px rgba(13,28,57,0.18)",
      },
    },
  },
  plugins: [],
};
