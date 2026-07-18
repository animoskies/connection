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
        ink: "#181715",
        paper: "#f4f1ea",
        line: "#d8d3c8",
        moss: "#65745a",
        rust: "#ad654c",
        skysoft: "#dfe7df"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(21, 21, 21, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
