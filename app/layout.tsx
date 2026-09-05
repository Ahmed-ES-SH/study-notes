import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { CommandPalette } from "../components/search/CommandPalette";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Study Notes",
  description: "Offline, hierarchical study notes for developers.",
};

// Applied before first paint so the correct palette renders immediately
// with no flash. Mirrors lib/hooks/useTheme.ts storage conventions.
const themeInitScript = `
(function () {
  try {
    var mode = localStorage.getItem("study-notes-theme") || "system";
    var dark = mode === "dark" || (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        {/* Global ⌘K / Ctrl+K command palette (self-contained client island) */}
        <CommandPalette />
      </body>
    </html>
  );
}
