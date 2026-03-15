import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminPagination } from "@/components/admin/admin-pagination";

export interface AdminListPageFrameProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  filterForm?: React.ReactNode;
  children: React.ReactNode;
  pagination: {
    page: number;
    totalPages: number;
    totalCount: number;
    createPageHref: (nextPage: number) => string;
  };
}

export function AdminListPageFrame({
  title,
  description,
  action,
  filterForm,
  children,
  pagination,
}: AdminListPageFrameProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            {action}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filterForm ? (
            <form className="flex flex-wrap items-center gap-2">{filterForm}</form>
          ) : null}
          {children}
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalCount}
            createPageHref={pagination.createPageHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
