// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  // 告诉 Tailwind 扫描这些文件中的类名
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // 启用深色模式
  darkMode: 'class', 
  theme: {
    extend: {
      colors: {
        // 迁移您自定义的颜色配置
        primary: '#4f46e5',
        secondary: '#10b981',
      },
    },
  },
  plugins: [],
}