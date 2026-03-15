import Link from "next/link";

import { Button } from "@/components/ui/button";

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  createPageHref: (nextPage: number) => string;
}

export function AdminPagination({
  page,
  totalPages,
  totalCount,
  createPageHref,
}: AdminPaginationProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-muted-foreground text-sm">
        Página {page} de {totalPages} ({totalCount} resultados)
      </p>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" disabled={page <= 1}>
          <Link href={createPageHref(Math.max(1, page - 1))}>Anterior</Link>
        </Button>
        <Button asChild variant="outline" disabled={page >= totalPages}>
          <Link href={createPageHref(Math.min(totalPages, page + 1))}>
            Próximo
          </Link>
        </Button>
      </div>
    </div>
  );
}
