export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    folder: <><path d="M3 6.5h6l2 2h10v9.8A1.7 1.7 0 0 1 19.3 20H4.7A1.7 1.7 0 0 1 3 18.3z"/><path d="M3 8.5h18"/></>,
    users: <><path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17 11a3.5 3.5 0 1 0-1.2-6.8M21 20v-1.5a3.4 3.4 0 0 0-2.5-3.3"/></>,
    "user-settings": <><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17.2 14.5a1.7 1.7 0 0 0 2.4 0l.5-.5 1.2 1.2-.5.5a1.7 1.7 0 0 0 0 2.4l.5.5-1.2 1.2-.5-.5a1.7 1.7 0 0 0-2.4 0l-.5.5-1.2-1.2.5-.5a1.7 1.7 0 0 0 0-2.4l-.5-.5 1.2-1.2z"/><circle cx="18.4" cy="16.9" r="1.1"/></>,
    wallet: <><path d="M4 6h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14"/><path d="M21 10h-5a2 2 0 0 0 0 4h5M16 12h.01"/></>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 3-4 3 2 5-7"/></>,
    check: <path d="m5 12 4 4L19 6"/>, question: <><path d="M9.4 9.3a2.7 2.7 0 1 1 4.9 1.6c-.6.8-1.7 1.1-2.2 2.1-.2.4-.3.7-.3 1.1"/><path d="M12 17h.01"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6.7v-2.4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h2.4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1V14h-.1a1.7 1.7 0 0 0-1.6 1z"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>, close: <><path d="m6 6 12 12M18 6 6 18"/></>, chevron: <path d="m9 18 6-6-6-6"/>, plus: <><path d="M12 5v14M5 12h14"/></>, arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>, search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>, more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}
