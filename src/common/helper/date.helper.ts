import dayjs from 'dayjs';
/**
 * Date helper
 */
export class DateHelper {
  /**
   * Add days
   * @param value
   * @param unit
   * @returns
   */
  static add(value: number, unit: dayjs.ManipulateType) {
    return dayjs(value).add(30, unit);
  }

  // format date
  static format(date: number | string | Date) {
    const d = new Date(date);
    return d.toISOString();
  }
  static formatDate(date: number | string | Date) {
    const d = new Date(date);
    return d.toDateString();
  }

  static now() {
    const date = new Date();
    return date;
  }

  static nowString() {
    const date = new Date();
    return date.toISOString();
  }

  static nowDate() {
    const date = new Date();
    return date.toDateString();
  }

  static addDays(dateData, days: number) {
    days = Number(days);
    const date = new Date(dateData.valueOf());
    date.setDate(date.getDate() + days);
    return date.toDateString();
  }

  static addMonths(dateData, months: number) {
    months = Number(months);
    const date = new Date(dateData.valueOf());
    date.setMonth(date.getMonth() + months);
    return date.toDateString();
  }

  static addYears(dateData, years: number) {
    years = Number(years);
    const date = new Date(dateData.valueOf());
    date.setFullYear(date.getFullYear() + years);
    return date.toDateString();
  }

  static addHours(dateData, hours: number) {
    hours = Number(hours);
    const date = new Date(dateData.valueOf());
    date.setHours(date.getHours() + hours);
    return date.toDateString();
  }

  static addMinutes(dateData, minutes: number) {
    minutes = Number(minutes);
    const date = new Date(dateData.valueOf());
    date.setMinutes(date.getMinutes() + minutes);
    return date.toDateString();
  }

  static addSeconds(dateData, seconds: number) {
    seconds = Number(seconds);
    const date = new Date(dateData.valueOf());
    date.setSeconds(date.getSeconds() + seconds);
    return date.toDateString();
  }

  static diff(
    date1: string,
    date2: string,
    unit?: dayjs.QUnitType | dayjs.OpUnitType,
    float?: boolean,
  ) {
    const date1Data = dayjs(date1);
    const date2Data = dayjs(date2);

    return date2Data.diff(date1Data, unit, float);
  }

  /**
   * Calculate relative time (e.g., "2 hours ago")
   * @param date The date to calculate relative time from
   * @returns Human-readable relative time string
   */
  static getTimeAgo(date: Date | string): string {
    const now = new Date();
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
  }
}
