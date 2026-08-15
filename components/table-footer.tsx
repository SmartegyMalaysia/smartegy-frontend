"use client";

import { ExportIcon } from "./export-icon";

export function TableFooter({
  currentPage,
  totalPages,
  visibleCount,
  totalCount,
  onPageChange,
  onExport,
  pageSize = 5,
}: {
  currentPage: number;
  totalPages: number;
  visibleCount: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onExport: () => void;
  pageSize?: number;
}) {
  const first = visibleCount ? (currentPage - 1) * pageSize + 1 : 0;
  const last = Math.min(currentPage * pageSize, totalCount);
  return <div className="case-table-footer">
    <span className="case-page-summary">Showing {first}–{last} of {totalCount}</span>
    <div className="case-table-actions">
      <button className="button button-secondary button-sm" type="button" onClick={onExport} disabled={!totalCount}><ExportIcon size={15}/><span>Export</span></button>
      <div className="pagination" aria-label="Table pagination">
        <button className="pagination-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>‹</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button className="pagination-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>›</button>
      </div>
    </div>
  </div>;
}
