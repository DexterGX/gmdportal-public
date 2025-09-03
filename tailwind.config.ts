import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // 👈 required for theme toggle
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#3B82F6",     // light blue accent
        brandLight: "#93C5FD",// lighter accent (optional)
      },
      ringColor: ({ theme }) => ({
        DEFAULT: theme("colors.brand"),
      }),
    },
  },
  plugins: [],
};

export default config;
