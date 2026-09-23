/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/**/*.tsx", "./src/**/*.ts"],
  theme: {
    extend: {
      colors: {
        primary: "#10b981",
        "primary-dark": "#059669",
        "primary-light": "#ecfdf5",
        background: { DEFAULT: "#f8faf9", dark: "#0f172a" },
        surface: { DEFAULT: "#ffffff", dark: "#1e293b" },
        "border-light": { DEFAULT: "#e2e8f0", dark: "#334155" },
        "text-main": { DEFAULT: "#1e293b", dark: "#f1f5f9" },
        "text-secondary": { DEFAULT: "#64748b", dark: "#94a3b8" },
      },
      fontFamily: {
        display: ["Lexend", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
