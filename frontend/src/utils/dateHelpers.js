/**
 * Date utility helpers for timezone synchronization (UTC+7 Asia/Bangkok)
 */

export const getTodayStr = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
};

export const getCurrentMonthStr = () => {
  return getTodayStr().slice(0, 7); // YYYY-MM
};

export const getCurrentYearStr = () => {
  return getTodayStr().slice(0, 4); // YYYY
};
