import mongoose from 'mongoose';

// Chỉ lưu tài khoản nội bộ. Khách gọi món không có bản ghi trong users.
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9._-]{3,50}$/,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ['admin', 'staff'] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, result) {
        delete result.passwordHash;
        return result;
      },
    },
  },
);

export default mongoose.model('User', userSchema);
