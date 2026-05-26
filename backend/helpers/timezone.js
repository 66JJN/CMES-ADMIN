/**
 * Thai Timezone Helpers
 * ใช้แทน toISOString() ที่เป็น UTC เพื่อให้วันที่ตรงกับเวลาไทย (UTC+7)
 */

export function getThaiDateStr(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
}

export function getThaiMonthStr(date = new Date()) {
  return getThaiDateStr(date).slice(0, 7); // YYYY-MM
}

export function getThaiYearStr(date = new Date()) {
  return getThaiDateStr(date).slice(0, 4); // YYYY
}
