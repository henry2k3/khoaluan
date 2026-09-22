import HttpError from './HttpError.js';

export const dashboardTimezone = 'Asia/Ho_Chi_Minh';
const dayMs = 86400000;
export const vietnamDate = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: dashboardTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

function checkDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new HttpError(400, 'Ngày phải có dạng YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < '2000-01-01' ||
    value > '2100-12-31'
  )
    throw new HttpError(
      400,
      'Ngày không tồn tại hoặc ngoài khoảng năm 2000–2100.',
    );
  return value;
}
const shiftDay = (date, days) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * dayMs)
    .toISOString()
    .slice(0, 10);

// now được controller truyền vào. Test truyền Date cố định, không đổi đồng hồ toàn cục.
export function dashboardRange(query, now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new Error('Cần now hợp lệ.');
  const allowed = ['period', 'month', 'from', 'to'];
  if (Object.keys(query).some((key) => !allowed.includes(key)))
    throw new HttpError(400, 'Tham số thống kê không hợp lệ.');
  const today = vietnamDate(now);
  let from, to;
  let period = query.period ?? 'today';
  if (query.from !== undefined || query.to !== undefined) {
    if (query.period !== undefined || query.month !== undefined)
      throw new HttpError(
        400,
        'Chọn period hoặc from/to, không kết hợp cả hai.',
      );
    from = checkDate(query.from);
    to = checkDate(query.to);
    period = 'custom';
  } else {
    if (!['today', '7d', '30d', 'month'].includes(period))
      throw new HttpError(400, 'period phải là today, 7d, 30d hoặc month.');
    if (query.month !== undefined && period !== 'month')
      throw new HttpError(400, 'month chỉ dùng với period=month.');
    to = today;
    from = shiftDay(today, period === '7d' ? -6 : period === '30d' ? -29 : 0);
    if (period === 'month') {
      const month = query.month ?? today.slice(0, 7);
      if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month))
        throw new HttpError(400, 'Tháng phải có dạng YYYY-MM.');
      from = checkDate(`${month}-01`);
      const next = new Date(`${from}T00:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      to = new Date(next.getTime() - dayMs).toISOString().slice(0, 10);
    }
  }
  // Việt Nam dùng UTC+07:00 trong phạm vi năm hỗ trợ, không đổi giờ mùa hè.
  // Nửa mở: nhận đầu ngày from, loại đầu ngày sau to. from=to là một ngày hợp lệ.
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + dayMs);
  const days = (end - start) / dayMs;
  if (days <= 0)
    throw new HttpError(400, 'Ngày bắt đầu không được sau ngày kết thúc.');
  if (days > 366) throw new HttpError(400, 'Khoảng thống kê tối đa 366 ngày.');
  return {
    period,
    from,
    to,
    start,
    end,
    today,
    timezone: dashboardTimezone,
    granularity: period === 'today' ? 'hour' : 'day',
    includesToday: from <= today && today <= to,
  };
}

export function dashboardListQuery(query, now) {
  const { limit = '10', ...dates } = query;
  if (
    typeof limit !== 'string' ||
    !/^[1-9]\d*$/.test(limit) ||
    Number(limit) > 50
  )
    throw new HttpError(400, 'limit phải là số nguyên từ 1 đến 50.');
  return { range: dashboardRange(dates, now), limit: Number(limit) };
}

export function revenueBuckets(range) {
  if (range.granularity === 'hour')
    return Array.from(
      { length: 24 },
      (_, hour) => `${range.from}T${String(hour).padStart(2, '0')}:00`,
    );
  const buckets = [];
  for (let date = range.from; date <= range.to; date = shiftDay(date, 1))
    buckets.push(date);
  return buckets;
}
