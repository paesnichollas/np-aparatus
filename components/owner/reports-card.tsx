"use client";

import { getOwnerReport } from "@/actions/get-owner-report";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useMemo, useState } from "react";

type ReportRange = "WEEK" | "MONTH";

type OwnerReportData = {
  barbershopId: string;
  range: ReportRange;
  from: string;
  to: string;
  totalOrders: number;
  revenueInCents: number;
  averageTicketInCents: number;
};

type BarbershopOption = {
  id: string;
  name: string;
};

type OwnerReportsCardProps = {
  initialRange: ReportRange;
  isAdmin: boolean;
  initialBarbershopId: string | null;
  barbershopOptions: BarbershopOption[];
};

const rangeOptions: Array<{ label: string; value: ReportRange }> = [
  {
    label: "Semanal (ultimos 7 dias)",
    value: "WEEK",
  },
  {
    label: "Mensal (ultimos 30 dias)",
    value: "MONTH",
  },
];

const getValidationErrorMessage = (validationErrors: unknown) => {
  if (!validationErrors || typeof validationErrors !== "object") {
    return null;
  }

  const errors = (validationErrors as { _errors?: unknown })._errors;

  if (!Array.isArray(errors) || typeof errors[0] !== "string") {
    return null;
  }

  return errors[0];
};

const formatDateLabel = (isoDate: string) => {
  const parsedDate = new Date(isoDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString("pt-BR");
};

const MetricCard = ({
  title,
  value,
}: {
  title: string;
  value: string;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
};

const OwnerReportsCard = ({
  initialRange,
  isAdmin,
  initialBarbershopId,
  barbershopOptions,
}: OwnerReportsCardProps) => {
  const [range, setRange] = useState<ReportRange>(initialRange);
  const [selectedBarbershopId, setSelectedBarbershopId] = useState(
    initialBarbershopId ?? "",
  );
  const { execute, isPending, result } = useAction(getOwnerReport);

  const canLoadReport = !isAdmin || selectedBarbershopId.length > 0;

  const selectedBarbershopName = useMemo(() => {
    if (!isAdmin) {
      return null;
    }

    const selectedBarbershop = barbershopOptions.find(
      (barbershop) => barbershop.id === selectedBarbershopId,
    );

    return selectedBarbershop?.name ?? null;
  }, [barbershopOptions, isAdmin, selectedBarbershopId]);

  useEffect(() => {
    if (!canLoadReport) {
      return;
    }

    execute({
      range,
      barbershopId: selectedBarbershopId || undefined,
    });
  }, [canLoadReport, execute, range, selectedBarbershopId]);

  const validationErrorMessage = getValidationErrorMessage(result.validationErrors);
  const serverErrorMessage =
    result.serverError && !validationErrorMessage
      ? "Nao foi possivel carregar o relatorio agora."
      : null;
  const errorMessage = validationErrorMessage ?? serverErrorMessage;
  const reportData: OwnerReportData | undefined = canLoadReport
    ? result.data
    : undefined;

  const metricValues = useMemo(() => {
    if (!reportData || errorMessage) {
      return {
        totalOrders: "0",
        revenue: formatCurrency(0),
        averageTicket: formatCurrency(0),
      };
    }

    return {
      totalOrders: reportData.totalOrders.toLocaleString("pt-BR"),
      revenue: formatCurrency(reportData.revenueInCents),
      averageTicket: formatCurrency(reportData.averageTicketInCents),
    };
  }, [errorMessage, reportData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatorio</CardTitle>
        <CardDescription>
          Analise pedidos e faturamento por periodo para acompanhar o desempenho
          da barbearia.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="owner-report-range" className="text-sm font-medium">
              Periodo
            </label>
            <select
              id="owner-report-range"
              value={range}
              onChange={(event) => setRange(event.target.value as ReportRange)}
              disabled={isPending}
              className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {isAdmin ? (
            <div className="space-y-2">
              <label
                htmlFor="owner-report-barbershop"
                className="text-sm font-medium"
              >
                Barbearia
              </label>
              <select
                id="owner-report-barbershop"
                value={selectedBarbershopId}
                onChange={(event) => setSelectedBarbershopId(event.target.value)}
                disabled={isPending}
                className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Selecione uma barbearia</option>
                {barbershopOptions.map((barbershop) => (
                  <option key={barbershop.id} value={barbershop.id}>
                    {barbershop.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {!canLoadReport ? (
          <p className="text-muted-foreground text-sm">
            Selecione uma barbearia para visualizar o relatorio.
          </p>
        ) : null}

        {errorMessage ? (
          <Card className="border-destructive/30">
            <CardContent>
              <p className="text-sm font-medium">{errorMessage}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard title="Pedidos" value={metricValues.totalOrders} />
          <MetricCard title="Faturamento" value={metricValues.revenue} />
          <MetricCard title="Ticket medio" value={metricValues.averageTicket} />
        </div>

        {isPending ? (
          <p className="text-muted-foreground text-sm">Atualizando relatorio...</p>
        ) : null}

        {reportData && !errorMessage ? (
          <p className="text-muted-foreground text-sm">
            Periodo analisado: {formatDateLabel(reportData.from)} ate{" "}
            {formatDateLabel(reportData.to)}
            {selectedBarbershopName ? ` - ${selectedBarbershopName}` : ""}
          </p>
        ) : null}

        {reportData && !errorMessage && reportData.totalOrders === 0 ? (
          <Card>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Nenhum pedido confirmado encontrado no periodo selecionado.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default OwnerReportsCard;
