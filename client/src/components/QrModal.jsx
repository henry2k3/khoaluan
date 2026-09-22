import { useEffect, useState } from 'react';
import { tableApi } from '../api/catalogApi.js';
import { errorMessage } from '../utils/display.js';
import DataStatus from './DataStatus.jsx';
import Modal from './Modal.jsx';

export default function QrModal({ table, onClose }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    tableApi
      .qr(table._id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setQr(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [table._id, attempt]);
  return (
    <Modal title={`QR · ${table.name}`} onClose={onClose}>
      <DataStatus
        loading={loading}
        error={error}
        onRetry={() => setAttempt((value) => value + 1)}
      />
      {!loading && !error && qr && (
        <>
          {!qr.isActive && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-amber-800">
              Bàn đang tắt. Khách mở QR sẽ thấy thông báo không phục vụ.
            </p>
          )}
          <img
            src={qr.imageDataUrl}
            alt={`Mã QR mở menu ${qr.tableName}`}
            className="mx-auto w-full max-w-80"
          />
          <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {qr.menuUrl}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={qr.imageDataUrl}
              download={`qr-ban-${qr.tableId}.png`}
              className="button-primary"
            >
              Tải QR PNG
            </a>
            <a
              href={qr.menuUrl}
              target="_blank"
              rel="noreferrer"
              className="button-secondary"
            >
              Mở menu của bàn
            </a>
          </div>
        </>
      )}
    </Modal>
  );
}
