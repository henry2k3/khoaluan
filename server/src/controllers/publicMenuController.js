import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import HttpError from '../utils/HttpError.js';
import { validateId } from '../utils/catalogValidation.js';

export async function getPublicTable(req, res) {
  if (!/^[a-f0-9]{48}$/.test(req.params.qrToken))
    throw new HttpError(404, 'Mã QR không hợp lệ hoặc bàn không tồn tại.');
  const table = await Table.findOne({ qrToken: req.params.qrToken });
  if (!table)
    throw new HttpError(404, 'Mã QR không hợp lệ hoặc bàn không tồn tại.');
  if (!table.isActive)
    throw new HttpError(
      403,
      'Bàn này hiện không phục vụ. Vui lòng liên hệ nhân viên.',
    );
  res.json({
    success: true,
    data: { _id: table.id, name: table.name, capacity: table.capacity },
  });
}

export async function listPublicCategories(req, res) {
  const categories = await Category.find({ isActive: true })
    .select('name description sortOrder')
    .sort({ sortOrder: 1, name: 1, _id: 1 });
  res.json({ success: true, data: categories });
}

export async function listPublicProducts(req, res) {
  if (req.query.categoryId !== undefined)
    validateId(req.query.categoryId, 'Mã danh mục');
  const categories = await Category.find({ isActive: true }).select('_id');
  const activeIds = categories.map((category) => category.id);
  const categoryIds = req.query.categoryId
    ? activeIds.filter((id) => id === req.query.categoryId)
    : activeIds;
  const products = await Product.find({
    isActive: true,
    categoryId: { $in: categoryIds },
  })
    .select('categoryId name description price imageUrl isAvailable')
    .sort({ name: 1, _id: 1 });
  res.json({ success: true, data: products });
}

export async function getPublicProduct(req, res) {
  validateId(req.params.id, 'Mã món');
  const product = await Product.findOne({
    _id: req.params.id,
    isActive: true,
  }).select('categoryId name description price imageUrl isAvailable');
  if (
    !product ||
    !(await Category.exists({ _id: product.categoryId, isActive: true }))
  ) {
    throw new HttpError(404, 'Món không còn hiển thị trong thực đơn.');
  }
  res.json({ success: true, data: product });
}
