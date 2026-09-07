import type { ReactNode } from "react";
type DataTableHeaderConfig = { content: ReactNode; ariaSort?: "ascending" | "descending" | "none" };
export type DataTableHeader = ReactNode | DataTableHeaderConfig;
function isHeaderConfig(header: DataTableHeader): header is DataTableHeaderConfig { return typeof header === "object" && header !== null && !Array.isArray(header) && Object.prototype.hasOwnProperty.call(header, "content"); }
export function DataTable({ caption, headers, children }: { caption: string; headers: DataTableHeader[]; children: ReactNode }) { return <div className="table-wrap"><table><caption className="sr-only">{caption}</caption><thead><tr>{headers.map((header, index) => { const config = isHeaderConfig(header) ? header : null; return <th key={index} scope="col" aria-sort={config?.ariaSort}>{config ? config.content : header as ReactNode}</th>; })}</tr></thead><tbody>{children}</tbody></table></div>; }
