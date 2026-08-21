import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceShell } from "@/components/workspace-shell";
export const metadata: Metadata = {
  description: "Sign in to the Smartegy operations workspace",
  icons: {
    icon: "/icons/smartegy-logo-icon-only-favicon.png",
    shortcut: "/icons/smartegy-logo-icon-only-favicon.png",
    apple: "/icons/smartegy-logo-icon-only-favicon.png",
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en-MY"><body><WorkspaceShell>{children}</WorkspaceShell></body></html>; }
