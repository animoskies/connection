import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#151515",
        paper: "#f8f7f4",
        line: "#dedbd4",
        moss: "#6f7f5f",
        rust: "#b66345",
        skysoft: "#8fb8c9"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(21, 21, 21, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
