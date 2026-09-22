import mongoose from 'mongoose';
import { orderStatuses } from '../utils/orderStatus.js';

const money = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};
const statuses = orderStatuses;
const itemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: { type: String, required: true, maxlength: 100 },
    unitPrice: money,
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
      validate: Number.isInteger,
    },
    note: { type: String, default: '', maxlength: 500 },
    lineTotal: money,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true, immutable: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    tableName: { type: String, required: true, maxlength: 100 },
    items: {
      type: [itemSchema],
      validate: (items) => items.length >= 1 && items.length <= 50,
    },
    note: { type: String, default: '', maxlength: 1000 },
    totalAmount: money,
    paidAt: { type: Date, default: null },
    cancelReason: { type: String, default: '', trim: true, maxlength: 1000 },
    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: statuses,
      default: 'pending',
      required: true,
    },
    trackingTokenHash: { type: String, required: true, select: false },
    // Số ngẫu nhiên để server tái tạo cùng token khi trả lại một lần gửi đã xử lý.
    // Chỉ biết nonce và hash trong DB không đủ tính token: còn cần ORDER_TOKEN_SECRET.
    trackingTokenNonce: { type: String, required: true, select: false },
    requestIdHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    requestPayloadHash: { type: String, required: true, select: false },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: statuses, required: true },
        changedAt: { type: Date, required: true },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      },
    ],
  },
  { timestamps: true },
);

// Phục vụ danh sách mới nhất, lọc trạng thái/bàn và đếm đơn đang xử lý.
orderSchema.index({ createdAt: -1, _id: -1 });
orderSchema.index({ status: 1, createdAt: -1, _id: -1 });
orderSchema.index({ tableId: 1, status: 1, createdAt: -1 });
// Explain với 3.660 đơn: giảm số document đọc của một ngày từ 3.660 xuống 10.
orderSchema.index({ status: 1, paidAt: 1 });

export default mongoose.model('Order', orderSchema);
