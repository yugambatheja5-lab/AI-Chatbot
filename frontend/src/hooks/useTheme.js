import { useEffect, useState } from "react";

const STORAGE_KEY = "knowledge-ai-theme";

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((value) => value === "dark" ? "light" : "dark"),
  };
}