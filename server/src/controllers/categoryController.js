import Category from '../models/Category.js';
import HttpError from '../utils/HttpError.js';
import { validateFields, validateId } from '../utils/catalogValidation.js';

const fields = ['name', 'description', 'sortOrder', 'isActive'];

export async function listCategories(req, res) {
  const categories = await Category.find().sort({
    sortOrder: 1,
    name: 1,
    _id: 1,
  });
  res.json({ success: true, data: categories });
}

export async function createCategory(req, res) {
  const data = validateFields(req.body, fields, ['name']);
  const category = await Category.create(data);
  res.status(201).json({ success: true, data: category });
}

export async function updateCategory(req, res) {
  validateId(req.params.id);
  const data = validateFields(req.body, fields);
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!category) throw new HttpError(404, 'Không tìm thấy danh mục.');
  res.json({ success: true, data: category });
}
