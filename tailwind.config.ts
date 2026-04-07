import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "Georgia", "serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        saffron: {
          50: "#fff8f0",
          100: "#ffeccc",
          200: "#ffd280",
          300: "#ffb733",
          400: "#f59e0b",
          500: "#d97706",
          600: "#b45309",
          700: "#92400e",
        },
        ink: {
          50: "#f8f7f4",
          100: "#eeecea",
          200: "#d5d2cc",
          300: "#b0aca4",
          400: "#857f75",
          500: "#5c5750",
          600: "#3d3a34",
          700: "#282520",
          800: "#1a1714",
          900: "#0f0d0b",
        },
        moss: {
          50: "#f0f7f0",
          100: "#d4ebd4",
          200: "#9fd19f",
          300: "#5cac5c",
          400: "#2d8a2d",
          500: "#1a6b1a",
        },
        crimson: {
          50: "#fdf2f2",
          100: "#fce0e0",
          200: "#f8b4b4",
          300: "#f27474",
          400: "#e53535",
          500: "#c01c1c",
        },
        sky: {
          50: "#f0f6ff",
          100: "#d6e8ff",
          200: "#a8c9ff",
          300: "#6aa3f7",
          400: "#3b7de8",
          500: "#1d5abf",
        },
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease forwards",
        "slide-in": "slideIn 0.3s ease forwards",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-6px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
