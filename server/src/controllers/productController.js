import Category from '../models/Category.js';
import Product from '../models/Product.js';
import HttpError from '../utils/HttpError.js';
import { validateFields, validateId } from '../utils/catalogValidation.js';

const fields = [
  'categoryId',
  'name',
  'description',
  'price',
  'imageUrl',
  'isAvailable',
  'isActive',
];

async function checkCategory(categoryId) {
  if (categoryId && !(await Category.exists({ _id: categoryId }))) {
    throw new HttpError(400, 'Danh mục không tồn tại. Vui lòng chọn lại.');
  }
}

export async function listProducts(req, res) {
  const filter = {};
  if (req.query.categoryId !== undefined)
    filter.categoryId = validateId(req.query.categoryId, 'Mã danh mục');
  const products = await Product.find(filter).sort({ createdAt: -1, _id: 1 });
  res.json({ success: true, data: products });
}

export async function createProduct(req, res) {
  const data = validateFields(req.body, fields, [
    'categoryId',
    'name',
    'price',
  ]);
  await checkCategory(data.categoryId);
  const product = await Product.create(data);
  res.status(201).json({ success: true, data: product });
}

export async function updateProduct(req, res) {
  validateId(req.params.id);
  const data = validateFields(req.body, fields);
  await checkCategory(data.categoryId);
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!product) throw new HttpError(404, 'Không tìm thấy món.');
  res.json({ success: true, data: product });
}
