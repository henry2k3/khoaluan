import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useCart } from '../../contexts/CartContext.jsx';
import GuestOrders from '../../components/GuestOrders.jsx';
import { publicMenuApi } from '../../api/publicMenuApi.js';
import { errorMessage, formatMoney } from '../../utils/display.js';
import DataStatus from '../../components/DataStatus.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import MenuProductDetails from '../../components/MenuProductDetails.jsx';

// Đổi QR sẽ khởi tạo lại state, không mang tên/bàn cũ sang QR mới.
export default function CustomerMenuPage() {
  const { qrToken } = useParams();
  return <MenuForTable key={qrToken} qrToken={qrToken} />;
}

function MenuForTable({ qrToken }) {
  const { cart, setCustomerName } = useCart();
  const { customerName } = cart;
  const [nameInput, setNameInput] = useState(customerName);
  const [nameError, setNameError] = useState('');
  const [table, setTable] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadMenu() {
      setLoading(true);
      setError('');
      setSelectedProduct(null);
      try {
        // Kiểm tra lại bàn cả lúc mở QR, nhập tên và làm mới menu.
        const currentTable = await publicMenuApi.table(
          qrToken,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setTable(currentTable);
        if (customerName) {
          const [nextCategories, nextProducts] = await Promise.all([
            publicMenuApi.categories(controller.signal),
            publicMenuApi.products(controller.signal),
          ]);
          if (controller.signal.aborted) return;
          setCategories(nextCategories);
          setProducts(nextProducts);
          setActiveCategory((current) =>
            nextCategories.some((category) => category._id === current)
              ? current
              : '',
          );
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setTable(null);
          setError(errorMessage(failure));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadMenu();
    return () => controller.abort();
  }, [qrToken, customerName, version]);

  function startMenu(event) {
    event.preventDefault();
    const name = nameInput.trim();
    if (!name || name.length > 100) {
      setNameError('Vui lòng nhập tên từ 1 đến 100 ký tự.');
      return;
    }
    setNameError('');
    setCustomerName(name);
  }
  function changeName() {
    setNameInput(customerName);
    setCustomerName('');
    setSelectedProduct(null);
  }
  const visibleProducts = products.filter(
    (product) => !activeCategory || product.categoryId === activeCategory,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <p className="text-lg font-bold tracking-tight">Nhà hàng / Cafe QR</p>
          {table && !loading && !error && (
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800">
              {table.name}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pt-8 pb-28">
        {(loading || error) && (
          <DataStatus
            loading={loading}
            error={error}
            onRetry={() => setVersion((value) => value + 1)}
          />
        )}
        {!loading && !error && table && !customerName && (
          <section className="mx-auto max-w-md panel p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
              Chào mừng bạn
            </p>
            <h1 className="mt-3 text-3xl font-bold">Mời bạn xem thực đơn</h1>
            <p className="mt-4 leading-7 text-slate-600">
              Bạn đang ở <strong>{table.name}</strong>. Cho chúng mình biết tên
              để tiện phục vụ nhé.
            </p>
            <form onSubmit={startMenu} className="mt-6 space-y-4">
              <label
                htmlFor="customer-name"
                className="block text-sm font-medium"
              >
                Tên của bạn
              </label>
              <input
                id="customer-name"
                name="customerName"
                className="form-input"
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                required
                maxLength={100}
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
              />
              {nameError && (
                <p role="alert" className="text-sm text-red-700">
                  {nameError}
                </p>
              )}
              <button className="button-primary w-full">Bắt đầu gọi món</button>
            </form>
            <p className="mt-5 text-sm leading-6 text-slate-500">
              Tên chỉ dùng để hiển thị khi gọi món. Bạn không cần tài khoản hoặc
              mật khẩu.
            </p>
          </section>
        )}
        {!loading && !error && table && customerName && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="break-words text-sm text-slate-600">
                  Xin chào, <strong>{customerName}</strong>
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  Thực đơn hôm nay
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={changeName}
                  disabled={!!cart.pending}
                  className="button-secondary"
                >
                  Đổi tên
                </button>
                <button
                  type="button"
                  onClick={() => setVersion((value) => value + 1)}
                  className="button-secondary"
                >
                  Làm mới menu
                </button>
              </div>
            </div>
            <GuestOrders />
            <nav
              aria-label="Danh mục món"
              className="mt-7 flex flex-wrap gap-2"
            >
              <button
                type="button"
                aria-pressed={!activeCategory}
                onClick={() => setActiveCategory('')}
                className={
                  !activeCategory ? 'button-primary' : 'button-secondary'
                }
              >
                Tất cả
              </button>
              {categories.map((category) => (
                <button
                  key={category._id}
                  type="button"
                  aria-pressed={activeCategory === category._id}
                  onClick={() => setActiveCategory(category._id)}
                  className={
                    activeCategory === category._id
                      ? 'button-primary'
                      : 'button-secondary'
                  }
                >
                  {category.name}
                </button>
              ))}
            </nav>
            <div className="mt-6">
              {!visibleProducts.length && (
                <p className="panel text-slate-500">
                  Hiện chưa có món trong danh mục này. Bạn có thể chọn danh mục
                  khác hoặc liên hệ nhân viên.
                </p>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((product) => (
                  <article
                    key={product._id}
                    data-product-id={product._id}
                    className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <ProductImage
                      src={product.imageUrl}
                      name={product.name}
                      className="aspect-[4/3] w-full"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="min-w-0 break-words text-lg font-bold">
                          {product.name}
                        </h2>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${product.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
                        >
                          {product.isAvailable ? 'Còn món' : 'Hết món'}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-slate-500">
                        {product.description || 'Món ngon dành cho bạn.'}
                      </p>
                      <p className="mt-4 text-lg font-bold text-teal-700">
                        {formatMoney(product.price)}
                      </p>
                      <button
                        type="button"
                        disabled={!product.isAvailable || !!cart.pending}
                        onClick={() => setSelectedProduct(product._id)}
                        className="button-secondary mt-4 w-full"
                      >
                        {product.isAvailable ? 'Thêm vào giỏ' : 'Tạm hết món'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      {customerName && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 shadow-lg">
          <Link
            to={`/menu/${qrToken}/cart`}
            className="button-primary mx-auto flex w-full max-w-lg"
          >
            {cart.pending
              ? 'Kiểm tra lần gửi trước'
              : `Giỏ hàng (${cart.items.reduce((sum, item) => sum + item.quantity, 0)})`}
          </Link>
        </div>
      )}
      {selectedProduct && (
        <MenuProductDetails
          productId={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
