import QRCode from 'qrcode';
import Table from '../models/Table.js';
import Order from '../models/Order.js';
import { activeOrderStatuses } from '../utils/orderStatus.js';
import { env } from '../config/env.js';
import HttpError from '../utils/HttpError.js';
import { validateFields, validateId } from '../utils/catalogValidation.js';

const fields = ['name', 'capacity', 'isActive'];

export async function listTables(req, res) {
  res.set('Cache-Control', 'no-store');
  const [tables, counts] = await Promise.all([
    Table.find().sort({ name: 1, _id: 1 }).lean(),
    Order.aggregate([
      { $match: { status: { $in: activeOrderStatuses } } },
      { $group: { _id: '$tableId', count: { $sum: 1 } } },
    ]),
  ]);
  const countsByTable = new Map(
    counts.map((item) => [item._id.toString(), item.count]),
  );
  const data = tables.map((table) => {
    const activeOrderCount = countsByTable.get(table._id.toString()) || 0;
    // Giá trị tính lúc đọc, tuyệt đối không ghi status vào Table.
    const result = {
      ...table,
      occupancy: activeOrderCount ? 'occupied' : 'empty',
      activeOrderCount,
    };
    if (req.user.role !== 'admin') delete result.qrToken;
    return result;
  });
  res.json({ success: true, data });
}

export async function createTable(req, res) {
  const data = validateFields(req.body, fields, ['name', 'capacity']);
  // Bảo đảm unique index sẵn sàng trước khi tạo bàn đầu tiên.
  await Table.init();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const table = await Table.create(data);
      return res.status(201).json({ success: true, data: table });
    } catch (error) {
      // Xác suất trùng rất thấp; nếu trùng, model tự tạo token mới khi thử lại.
      if (error.code !== 11000 || !error.keyPattern?.qrToken || attempt === 2)
        throw error;
    }
  }
}

export async function updateTable(req, res) {
  validateId(req.params.id);
  const data = validateFields(req.body, fields);
  const table = await Table.findByIdAndUpdate(
    req.params.id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!table) throw new HttpError(404, 'Không tìm thấy bàn.');
  res.json({ success: true, data: table });
}

export async function getTableQr(req, res) {
  validateId(req.params.id);
  const table = await Table.findById(req.params.id);
  if (!table) throw new HttpError(404, 'Không tìm thấy bàn.');
  const menuUrl = new URL(`/menu/${table.qrToken}`, env.publicAppUrl).href;
  const imageDataUrl = await QRCode.toDataURL(menuUrl, {
    width: 360,
    margin: 4,
    errorCorrectionLevel: 'M',
  });
  // Chỉ trả ảnh về trình duyệt; không lưu ảnh vào MongoDB.
  res.json({
    success: true,
    data: {
      tableId: table.id,
      tableName: table.name,
      isActive: table.isActive,
      menuUrl,
      imageDataUrl,
    },
  });
}
