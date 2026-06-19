/**
 * Date helpers for `<input type="datetime-local">`.
 *
 * A datetime-local input is timezone-NAIVE: it shows and accepts a plain
 * wall-clock string (`YYYY-MM-DDTHH:mm`) and the browser interprets it in the
 * user's local zone. The matching parse on save is `new Date(value)`, which
 * also reads the string as local time.
 *
 * The two halves MUST agree. If you populate the input with a UTC wall-clock
 * string (e.g. `date.toISOString().slice(0, 16)`) but save it with
 * `new Date(value)`, the value silently shifts by the local UTC offset on every
 * open/save round-trip. Always pair `new Date(value)` (save) with
 * `toLocalInputValue(date)` (populate).
 */

/**
 * Format a Date as `YYYY-MM-DDTHH:mm` in LOCAL time, suitable as the `value`
 * of an `<input type="datetime-local">`. Round-trips losslessly with
 * `new Date(value)`.
 */
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
