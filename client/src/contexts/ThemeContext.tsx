import React, { createContext, useContext, useEffect, useState } from "react";

export type SiteTheme = "dark" | "glass" | "light" | "fintech" | "cyberpunk";

interface ThemeContextType {
  theme: SiteTheme;
  setTheme: (theme: SiteTheme) => void;
  setPreviewTheme: (theme: SiteTheme | null) => void;
  confirmTheme: () => void;
  isPreviewing: boolean;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: SiteTheme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [confirmedTheme, setConfirmedTheme] = useState<SiteTheme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("tradecoin-site-theme");
      return (stored as SiteTheme) || defaultTheme;
    }
    return defaultTheme;
  });
  const [previewTheme, setPreviewTheme] = useState<SiteTheme | null>(null);
  const theme = previewTheme ?? confirmedTheme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.siteTheme = theme;
    root.classList.toggle("dark", theme !== "light");

  }, [theme]);

  useEffect(() => {
    if (switchable) localStorage.setItem("tradecoin-site-theme", confirmedTheme);
  }, [confirmedTheme, switchable]);

  const setTheme = (nextTheme: SiteTheme) => {
    setConfirmedTheme(nextTheme);
    setPreviewTheme(null);
  };

  const confirmTheme = () => {
    if (previewTheme) {
      setConfirmedTheme(previewTheme);
      setPreviewTheme(null);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, setPreviewTheme, confirmTheme, isPreviewing: Boolean(previewTheme), toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"), switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
