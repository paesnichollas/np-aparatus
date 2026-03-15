const normalizeServiceIds = (serviceIds: string[]) => {
  const uniqueServiceIds = new Set(serviceIds);
  return Array.from(uniqueServiceIds).sort((firstServiceId, secondServiceId) => {
    return firstServiceId.localeCompare(secondServiceId);
  });
};

export const queryKeys = {
  getDateAvailableTimeSlots: (
    barbershopId: string,
    barberId: string | undefined,
    serviceIds: string[],
    date?: Date,
  ) => [
    "date-available-time-slots",
    barbershopId,
    barberId,
    normalizeServiceIds(serviceIds).join(","),
    date?.toISOString(),
  ],
  getWaitlistStatusForDay: (
    barbershopId: string,
    barberId: string | undefined,
    serviceId: string | undefined,
    dateDay: string | undefined,
  ) => ["waitlist-status-for-day", barbershopId, barberId, serviceId, dateDay],
  ownerReportDashboard: (barbershopId: string, year: number, month: number) =>
    ["owner-report-dashboard", barbershopId, year, month],
};
