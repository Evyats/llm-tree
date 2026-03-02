/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui"],
      },
      colors: {
        base: "#f6f3ea",
        paper: "#fffdf7",
        ink: "#1e1f20",
        accent: "#176b87",
        warm: "#cb7f3f",
      },
      boxShadow: {
        float: "0 14px 40px rgba(20, 35, 46, 0.16)",
      },
    },
  },
  plugins: [],
};