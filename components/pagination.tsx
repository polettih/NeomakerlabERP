"use client";
import { useState } from "react";

/** Paginação no cliente: o filtro/busca continua valendo sobre a lista inteira. */
export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages); // se o filtro encolher a lista, volta para a última página
  const pageItems = items.slice((current - 1) * pageSize, current * pageSize);
  return { pageItems, page: current, setPage, pages, total: items.length, pageSize };
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="filters-row" style={{ justifyContent: "space-between", marginTop: 12 }}>
      <span className="muted">
        {from}–{to} de {total}
      </span>
      <span className="actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Anterior
        </button>
        <span className="muted">
          Página {page} de {pages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Próxima →
        </button>
      </span>
    </div>
  );
}
