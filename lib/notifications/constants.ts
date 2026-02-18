export const NOTIFICATION_MAX_ATTEMPTS = 5;

const RETRY_BACKOFF_MINUTES = [1, 2, 5, 10, 15];

export const getNotificationRetryDate = (
  attemptsAfterFailure: number,
  now = new Date(),
) => {
  if (attemptsAfterFailure < 1) {
    throw new Error("attemptsAfterFailure deve ser maior que zero.");
  }

  const backoffIndex = Math.min(attemptsAfterFailure - 1, RETRY_BACKOFF_MINUTES.length - 1);
  const retryInMinutes = RETRY_BACKOFF_MINUTES[backoffIndex] ?? 1;

  return new Date(now.getTime() + retryInMinutes * 60_000);
};
