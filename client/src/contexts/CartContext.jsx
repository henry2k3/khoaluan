import { createContext, useContext, useEffect, useState } from 'react';
import {
  cartKey,
  emptyCart,
  readCart,
  writeCart,
  newRequestId,
} from '../utils/guestStorage.js';

const CartContext = createContext(null);
const storageMessage =
  'Không lưu được giỏ hàng. Hãy cho phép trình duyệt lưu dữ liệu hoặc kiểm tra dung lượng. Đơn chưa rõ kết quả cần được thử lại trên trình duyệt này.';

export function CartProvider({ qrToken, children }) {
  const [cart, setCart] = useState(() => {
    try {
      return readCart(qrToken);
    } catch {
      return emptyCart();
    }
  });
  const [error, setError] = useState('');
  function accept(next) {
    setCart(next);
  }

  useEffect(() => {
    const sync = (event) => {
      if (event && event.key !== null && event.key !== cartKey(qrToken)) return;
      try {
        accept(readCart(qrToken));
        setError('');
      } catch {
        setError(storageMessage);
      }
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [qrToken]);

  function commit(update) {
    try {
      // Đọc lại để thấy thay đổi từ tab khác trước khi sửa hoặc gửi giỏ.
      const next = update(readCart(qrToken));
      writeCart(qrToken, next);
      accept(next);
      setError('');
      return next;
    } catch (failure) {
      const message = failure.guestMessage || storageMessage;
      setError(message);
      throw new Error(message);
    }
  }
  function edit(update) {
    try {
      commit((current) => {
        if (current.pending)
          throw {
            guestMessage:
              'Lần gửi trước chưa rõ kết quả. Mở giỏ hàng và kiểm tra lại đơn trước khi sửa.',
          };
        return update(current);
      });
      return true;
    } catch {
      return false;
    }
  }
  function addItem(product, quantity, note) {
    return edit((current) => {
      const existing = current.items.find(
        (item) => item.productId === product._id,
      );
      if (
        !product.isAvailable ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        (existing?.quantity || 0) + quantity > 99
      ) {
        throw {
          guestMessage:
            'Món phải còn hàng và tổng số lượng trong giỏ từ 1 đến 99.',
        };
      }
      if (!existing && current.items.length >= 50)
        throw { guestMessage: 'Giỏ chỉ chứa tối đa 50 món khác nhau.' };
      const item = {
        productId: product._id,
        productName: product.name,
        unitPrice: product.price,
        imageUrl: product.imageUrl || '',
        quantity: (existing?.quantity || 0) + quantity,
        note: note.trim(),
      };
      return {
        ...current,
        items: existing
          ? current.items.map((old) =>
              old.productId === product._id ? item : old,
            )
          : [...current.items, item],
      };
    });
  }
  function updateItem(productId, changes) {
    return edit((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.productId !== productId) return item;
        const next = { ...item, ...changes };
        if (
          !Number.isInteger(next.quantity) ||
          next.quantity < 1 ||
          next.quantity > 99
        )
          throw { guestMessage: 'Số lượng phải từ 1 đến 99.' };
        return next;
      }),
    }));
  }
  function prepareSubmission() {
    return commit((current) => {
      if (current.pending) return current;
      if (!current.customerName.trim() || !current.items.length)
        throw { guestMessage: 'Vui lòng nhập tên và chọn món trước khi gửi.' };
      const pending = {
        requestId: newRequestId(),
        qrToken,
        customerName: current.customerName.trim(),
        items: current.items.map(({ productId, quantity, note }) => ({
          productId,
          quantity,
          note,
        })),
        note: current.note,
      };
      return { ...current, pending };
    }).pending;
  }
  function finishSubmission(requestId, result) {
    commit((current) => {
      if (current.orders.some((order) => order.orderId === result.orderId))
        return current;
      if (current.pending?.requestId !== requestId)
        throw {
          guestMessage:
            'Giỏ đã thay đổi ở tab khác. Vui lòng mở lại giỏ để kiểm tra.',
        };
      // Lưu token và xóa giỏ trong CÙNG một lần ghi. Ghi lỗi thì vẫn giữ lần gửi cũ.
      return {
        ...current,
        items: [],
        note: '',
        pending: null,
        orders: [result, ...current.orders],
      };
    });
  }
  function rejectSubmission(requestId) {
    commit((current) =>
      current.pending?.requestId === requestId
        ? { ...current, pending: null }
        : current,
    );
  }
  return (
    <CartContext.Provider
      value={{
        cart,
        qrToken,
        error,
        addItem,
        updateItem,
        setCustomerName: (customerName) =>
          edit((current) => ({ ...current, customerName })),
        setNote: (note) => edit((current) => ({ ...current, note })),
        removeItem: (productId) =>
          edit((current) => ({
            ...current,
            items: current.items.filter((item) => item.productId !== productId),
          })),
        prepareSubmission,
        finishSubmission,
        rejectSubmission,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
