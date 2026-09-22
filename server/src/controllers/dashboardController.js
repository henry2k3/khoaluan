import {
  dashboardSummary,
  dashboardRevenue,
  dashboardProducts,
  dashboardRecentOrders,
} from '../services/dashboardService.js';

// Chỉ controller lấy giờ thật; service nhận now tường minh để test bằng mốc cố định.
export function dashboardControllers(clock = () => new Date()) {
  const respond = (service) => async (req, res) =>
    res.json({ success: true, data: await service(req.query, clock()) });
  return {
    getSummary: respond(dashboardSummary),
    getRevenue: respond(dashboardRevenue),
    getProducts: respond(dashboardProducts),
    getRecentOrders: respond(dashboardRecentOrders),
  };
}
