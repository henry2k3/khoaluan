export default function ConnectionCard({ title, value, connected }) {
  const colors = connected
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-xl border p-5 ${colors}`}>
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
