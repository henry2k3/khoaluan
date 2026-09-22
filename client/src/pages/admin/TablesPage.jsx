import { useRef, useState } from 'react';
import { Link } from 'react-router';
import TableOccupancy from '../../components/TableOccupancy.jsx';
import { tableApi } from '../../api/catalogApi.js';
import useAdminData from '../../hooks/useAdminData.js';
import { errorMessage } from '../../utils/display.js';
import DataStatus from '../../components/DataStatus.jsx';
import FormField from '../../components/FormField.jsx';
import QrModal from '../../components/QrModal.jsx';
import { useStaffRealtime } from '../../contexts/StaffRealtimeContext.jsx';
import useRealtimeRefresh from '../../realtime/useRealtimeRefresh.js';

const emptyForm = { name: '', capacity: 2, isActive: true };

export default function TablesPage() {
  const { data, loading, error, reload } = useAdminData(tableApi.list);
  const { connection } = useStaffRealtime();
  useRealtimeRefresh({
    connection,
    events: ['table:updated'],
    refresh: reload,
  });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [qrTable, setQrTable] = useState(null);
  const formRef = useRef(null);

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
  function edit(table) {
    setEditingId(table._id);
    setForm({
      name: table.name,
      capacity: table.capacity,
      isActive: table.isActive,
    });
    setMessage('');
    setFormError('');
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
        capacity: Number(form.capacity),
      };
      if (editingId) await tableApi.update(editingId, payload);
      else await tableApi.create(payload);
      setMessage(
        editingId
          ? 'Đã cập nhật bàn. QR hiện tại vẫn được giữ nguyên.'
          : 'Đã thêm bàn và tạo mã nhận diện QR riêng.',
      );
      reset();
      reload();
    } catch (failure) {
      setFormError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(table) {
    setBusy(true);
    setMessage('');
    setFormError('');
    try {
      await tableApi.update(table._id, { isActive: !table.isActive });
      if (editingId === table._id) reset();
      setMessage(
        table.isActive ? 'Đã tắt phục vụ bàn.' : 'Đã bật phục vụ bàn.',
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
      <h1 className="text-3xl font-bold">Bàn & mã QR</h1>
      <p className="mt-2 text-slate-600">
        Mỗi bàn có QR riêng. Bật hoặc tắt khả năng phục vụ tại bàn.
      </p>
      <button
        className="button-secondary mt-4"
        disabled={loading}
        onClick={reload}
      >
        Làm mới bàn
      </button>
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
            {editingId ? 'Sửa bàn' : 'Thêm bàn'}
          </h2>
          <FormField label="Tên bàn" id="table-name">
            <input
              id="table-name"
              name="name"
              className="form-input"
              required
              maxLength={100}
              value={form.name}
              onChange={change}
              disabled={busy}
            />
          </FormField>
          <FormField label="Số chỗ ngồi" id="table-capacity">
            <input
              id="table-capacity"
              name="capacity"
              type="number"
              min="1"
              max="100"
              step="1"
              className="form-input"
              required
              value={form.capacity}
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
            Bàn đang phục vụ
          </label>
          {formError && (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className="button-primary">
              {busy ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Thêm bàn'}
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
            emptyText="Chưa có bàn. Hãy thêm bàn để tạo QR."
          />
          {!loading &&
            !error &&
            data?.map((table) => (
              <article
                key={table._id}
                data-table-id={table._id}
                className="panel"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="break-words text-lg font-semibold">
                      {table.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {table.capacity} chỗ ·{' '}
                      {table.isActive ? 'Đang phục vụ' : 'Đã tắt phục vụ'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrTable(table)}
                    className="button-primary"
                  >
                    Xem QR
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="button-secondary"
                    to={`/admin/orders?status=active&tableId=${table._id}`}
                  >
                    Xem đơn đang xử lý
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => edit(table)}
                    className="button-secondary"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(table)}
                    className="button-secondary"
                  >
                    {table.isActive ? 'Tắt bàn' : 'Bật bàn'}
                  </button>
                </div>
                <TableOccupancy table={table} />
              </article>
            ))}
        </div>
      </div>
      {qrTable && <QrModal table={qrTable} onClose={() => setQrTable(null)} />}
    </section>
  );
}
