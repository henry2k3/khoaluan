import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, default: '', maxlength: 1000 },
    // Số nguyên, đơn vị đồng. Định dạng 35.000đ chỉ thực hiện khi hiển thị.
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    imageUrl: { type: String, trim: true, default: '', maxlength: 2000 },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Product', productSchema);
