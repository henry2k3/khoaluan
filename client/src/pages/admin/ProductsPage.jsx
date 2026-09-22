import { useRef, useState } from 'react';
import { loadProductData, productApi } from '../../api/catalogApi.js';
import useAdminData from '../../hooks/useAdminData.js';
import { errorMessage, formatMoney } from '../../utils/display.js';
import DataStatus from '../../components/DataStatus.jsx';
import FormField from '../../components/FormField.jsx';
import ProductImage from '../../components/ProductImage.jsx';

const emptyForm = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  isAvailable: true,
  isActive: true,
};

export default function ProductsPage() {
  const { data, loading, error, reload } = useAdminData(loadProductData);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const formRef = useRef(null);
  const categories = data?.categories || [];
  const products = (data?.products || []).filter(
    (product) => !filter || product.categoryId === filter,
  );

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }
  function reset() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
  }
  function edit(product) {
    setEditingId(product._id);
    setForm(
      Object.fromEntries(
        Object.keys(emptyForm).map((key) => [key, product[key]]),
      ),
    );
    setFormError('');
    setMessage('');
    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formRef.current.querySelector('input').focus({ preventScroll: true });
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        price: Number(form.price),
      };
      if (editingId) await productApi.update(editingId, payload);
      else await productApi.create(payload);
      setMessage(editingId ? 'Đã cập nhật món.' : 'Đã thêm món.');
      reset();
      reload();
    } catch (failure) {
      setFormError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(product, field) {
    setBusy(true);
    setMessage('');
    setFormError('');
    try {
      await productApi.update(product._id, { [field]: !product[field] });
      if (editingId === product._id) reset();
      setMessage('Đã cập nhật trạng thái món.');
      reload();
    } catch (failure) {
      setFormError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="text-3xl font-bold">Món ăn / Đồ uống</h1>
      <p className="mt-2 text-slate-600">
        Quản lý giá và tình trạng món. Món hết vẫn hiển thị; món ẩn sẽ không
        hiện cho khách.
      </p>
      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-emerald-800"
        >
          {message}
        </p>
      )}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        <form ref={formRef} onSubmit={save} className="panel space-y-4">
          <h2 className="text-lg font-semibold">
            {editingId ? 'Sửa món' : 'Thêm món'}
          </h2>
          {!loading && !categories.length && (
            <p className="text-sm text-amber-800">
              Cần thêm danh mục trước khi tạo món.
            </p>
          )}
          <FormField label="Tên món" id="product-name">
            <input
              id="product-name"
              name="name"
              className="form-input"
              required
              maxLength={100}
              value={form.name}
              onChange={change}
              disabled={busy}
            />
          </FormField>
          <FormField label="Danh mục" id="product-category">
            <select
              id="product-category"
              name="categoryId"
              className="form-input"
              required
              value={form.categoryId}
              onChange={change}
              disabled={busy}
            >
              <option value="">Chọn danh mục</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                  {!category.isActive ? ' (đang ẩn)' : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Giá (đồng)"
            id="product-price"
            hint="Nhập số nguyên, ví dụ 35000."
          >
            <input
              id="product-price"
              name="price"
              type="number"
              min="0"
              step="1"
              className="form-input"
              required
              value={form.price}
              onChange={change}
              disabled={busy}
            />
          </FormField>
          <FormField label="Mô tả" id="product-description">
            <textarea
              id="product-description"
              name="description"
              className="form-input"
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={change}
              disabled={busy}
            />
          </FormField>
          <FormField
            label="Đường dẫn ảnh"
            id="product-image"
            hint="URL http/https hoặc /images/ten-anh. Có thể để trống."
          >
            <input
              id="product-image"
              name="imageUrl"
              className="form-input"
              maxLength={2000}
              value={form.imageUrl}
              onChange={change}
              disabled={busy}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isAvailable"
              checked={form.isAvailable}
              onChange={change}
              disabled={busy}
            />
            Hiện còn món
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={change}
              disabled={busy}
            />
            Hiển thị cho khách
          </label>
          {formError && (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || loading || !categories.length}
              className="button-primary"
            >
              {busy ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Thêm món'}
            </button>
            {editingId && (
              <button
                type="button"
                disabled={busy}
                onClick={reset}
                className="button-secondary"
              >
                Hủy sửa
              </button>
            )}
          </div>
        </form>
        <div className="min-w-0 space-y-4">
          <FormField label="Lọc theo danh mục" id="product-filter">
            <select
              id="product-filter"
              className="form-input"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>
          <DataStatus
            loading={loading}
            error={error}
            empty={!products.length}
            onRetry={reload}
            emptyText="Chưa có món trong danh sách này."
          />
          {!loading &&
            !error &&
            products.map((product) => {
              const category = categories.find(
                (item) => item._id === product.categoryId,
              );
              return (
                <article
                  key={product._id}
                  data-product-id={product._id}
                  className="panel"
                >
                  <div className="flex gap-4">
                    <ProductImage
                      src={product.imageUrl}
                      name={product.name}
                      className="h-20 w-20 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        {category?.name || 'Danh mục không tồn tại'}
                      </p>
                      <h2 className="mt-1 break-words text-lg font-semibold">
                        {product.name}
                      </h2>
                      <p className="font-semibold text-teal-700">
                        {formatMoney(product.price)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {product.isActive ? 'Đang hiển thị' : 'Đã ẩn'} ·{' '}
                    {product.isAvailable ? 'Còn món' : 'Tạm hết món'}
                  </p>
                  {category && !category.isActive && (
                    <p className="mt-1 text-sm text-amber-800">
                      Danh mục đang ẩn nên món không hiện cho khách.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => edit(product)}
                      className="button-secondary"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(product, 'isAvailable')}
                      className="button-secondary"
                    >
                      {product.isAvailable ? 'Đánh dấu hết' : 'Đánh dấu còn'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(product, 'isActive')}
                      className="button-secondary"
                    >
                      {product.isActive ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </section>
  );
}
