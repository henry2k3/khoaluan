import { useRef, useState } from 'react';
import { categoryApi } from '../../api/catalogApi.js';
import useAdminData from '../../hooks/useAdminData.js';
import { errorMessage } from '../../utils/display.js';
import DataStatus from '../../components/DataStatus.jsx';
import FormField from '../../components/FormField.jsx';

const emptyForm = { name: '', description: '', sortOrder: 0, isActive: true };

export default function CategoriesPage() {
  const { data, loading, error, reload } = useAdminData(categoryApi.list);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const formRef = useRef(null);

  function change(event) {
    const { name, type, value, checked } = event.target;
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
  function edit(category) {
    setEditingId(category._id);
    setForm({
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
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
        sortOrder: Number(form.sortOrder),
      };
      if (editingId) await categoryApi.update(editingId, payload);
      else await categoryApi.create(payload);
      setMessage(editingId ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục.');
      reset();
      reload();
    } catch (failure) {
      setFormError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(category) {
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      await categoryApi.update(category._id, { isActive: !category.isActive });
      if (editingId === category._id) reset();
      setMessage(
        category.isActive
          ? 'Đã ẩn danh mục và các món thuộc danh mục khỏi menu khách.'
          : 'Đã hiện danh mục.',
      );
      reload();
    } catch (failure) {
      setFormError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="text-3xl font-bold">Quản lý danh mục</h1>
      <p className="mt-2 text-slate-600">
        Nhóm món theo loại. Danh mục bị ẩn sẽ không xuất hiện trên menu khách.
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
            {editingId ? 'Sửa danh mục' : 'Thêm danh mục'}
          </h2>
          <FormField label="Tên danh mục" id="category-name">
            <input
              id="category-name"
              name="name"
              className="form-input"
              required
              maxLength={100}
              value={form.name}
              onChange={change}
              disabled={busy}
            />
          </FormField>
          <FormField label="Mô tả" id="category-description">
            <textarea
              id="category-description"
              name="description"
              className="form-input"
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={change}
              disabled={busy}
            />
          </FormField>
          <FormField label="Thứ tự hiển thị" id="category-sort">
            <input
              id="category-sort"
              name="sortOrder"
              className="form-input"
              type="number"
              min="0"
              step="1"
              required
              value={form.sortOrder}
              onChange={change}
              disabled={busy}
            />
          </FormField>
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
            <button disabled={busy} className="button-primary">
              {busy
                ? 'Đang lưu…'
                : editingId
                  ? 'Lưu thay đổi'
                  : 'Thêm danh mục'}
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
        <div className="min-w-0 space-y-3">
          <DataStatus
            loading={loading}
            error={error}
            empty={!data?.length}
            onRetry={reload}
            emptyText="Chưa có danh mục. Hãy thêm danh mục đầu tiên."
          />
          {!loading &&
            !error &&
            data?.map((category) => (
              <article
                key={category._id}
                className="panel"
                data-category-id={category._id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold">
                      {category.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Thứ tự: {category.sortOrder} ·{' '}
                      {category.isActive ? 'Đang hiển thị' : 'Đã ẩn'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => edit(category)}
                      className="button-secondary"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(category)}
                      className="button-secondary"
                    >
                      {category.isActive ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>
                {category.description && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">
                    {category.description}
                  </p>
                )}
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
