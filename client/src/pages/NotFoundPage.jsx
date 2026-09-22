import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section className="py-12">
      <p className="font-semibold text-teal-700">404</p>
      <h1 className="mt-3 text-3xl font-bold">Không tìm thấy trang</h1>
      <p className="mt-4 text-slate-600">Đường dẫn này chưa có trong hệ thống.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-teal-700 underline">
        Về trang kiểm tra kết nối
      </Link>
    </section>
  );
}
