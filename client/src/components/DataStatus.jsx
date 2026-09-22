export default function DataStatus({
  loading,
  error,
  empty,
  onRetry,
  emptyText = 'Chưa có dữ liệu.',
}) {
  if (loading)
    return (
      <p role="status" className="panel text-slate-600">
        Đang tải dữ liệu…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="panel border-red-200">
        <p className="text-red-700">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="button-secondary mt-4"
        >
          Thử lại
        </button>
      </div>
    );
  if (empty) return <p className="panel text-slate-500">{emptyText}</p>;
  return null;
}
