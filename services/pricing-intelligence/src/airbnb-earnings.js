import { parseCsv, numberOrNull } from "./csv.js";

function isoDateFromUs(value) {
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

/**
 * Convert an Airbnb earnings CSV into a privacy-preserving reservation history.
 * Guest names, confirmation/reference codes, payout destinations and free-text
 * details are deliberately discarded.
 */
export function sanitizeAirbnbEarningsCsv(text) {
  const rows = parseCsv(text);
  const reservations = rows
    .filter((row) => row.Type === "Reservation")
    .map((row) => ({
      bookingDate: isoDateFromUs(row["Booking date"]),
      start: isoDateFromUs(row["Start date"]),
      endExclusive: isoDateFromUs(row["End date"]),
      nights: numberOrNull(row.Nights),
      currency: row.Currency || null,
      hostAmount: numberOrNull(row.Amount),
      serviceFee: numberOrNull(row["Service fee"]),
      cleaningFee: numberOrNull(row["Cleaning fee"]),
      grossEarnings: numberOrNull(row["Gross earnings"]),
      remittedTax: numberOrNull(row["Airbnb remitted tax"]),
    }));

  const summaryByCurrency = {};
  for (const reservation of reservations) {
    const currency = reservation.currency ?? "UNKNOWN";
    summaryByCurrency[currency] ??= {
      reservations: 0,
      nights: 0,
      hostAmount: 0,
      serviceFee: 0,
      cleaningFee: 0,
      grossEarnings: 0,
      remittedTax: 0,
    };
    const summary = summaryByCurrency[currency];
    summary.reservations += 1;
    summary.nights += reservation.nights ?? 0;
    summary.hostAmount += reservation.hostAmount ?? 0;
    summary.serviceFee += reservation.serviceFee ?? 0;
    summary.cleaningFee += reservation.cleaningFee ?? 0;
    summary.grossEarnings += reservation.grossEarnings ?? 0;
    summary.remittedTax += reservation.remittedTax ?? 0;
  }

  return {
    schema: "pmc.sanitized-booking-history/v1",
    provider: "airbnb",
    reservations,
    summaryByCurrency,
  };
}
