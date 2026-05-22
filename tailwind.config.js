/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "Microsoft YaHei",
          "Noto Sans CJK SC",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        glow: "0 0 42px rgba(77, 163, 255, 0.32)"
      }
    }
  },
  plugins: []
};
