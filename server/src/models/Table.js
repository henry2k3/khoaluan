import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      validate: Number.isSafeInteger,
    },
    // Chuỗi ngẫu nhiên 24 byte; chỉ mục unique là lớp kiểm tra không trùng trong DB.
    qrToken: {
      type: String,
      default: () => randomBytes(24).toString('hex'),
      unique: true,
      immutable: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Table', tableSchema);
