export default function TableOccupancy({ table }) {
  return (
    <div data-table-occupancy={table.occupancy} className="mt-3">
      <p
        className={`font-semibold ${table.occupancy === 'occupied' ? 'text-amber-800' : 'text-emerald-700'}`}
      >
        {table.occupancy === 'occupied' ? 'Đang sử dụng' : 'Trống'}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {table.activeOrderCount} đơn đang xử lý
      </p>
    </div>
  );
}
