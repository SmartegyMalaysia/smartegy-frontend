import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Sign in | Smartegy", description: "Sign in to the Smartegy operations workspace" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en-MY"><body>{children}</body></html>; }
