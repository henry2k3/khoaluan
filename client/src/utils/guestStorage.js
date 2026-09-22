export const cartKey = (qrToken) => `restaurant_qr_cart:v1:${qrToken}`;
const idPattern = /^[a-f0-9]{24}$/;
const secretPattern = /^[a-f0-9]{64}$/;

export function emptyCart() {
  return {
    version: 1,
    customerName: '',
    items: [],
    note: '',
    pending: null,
    orders: [],
  };
}

export function readCart(qrToken) {
  const raw = localStorage.getItem(cartKey(qrToken));
  if (!raw) {
    const cart = emptyCart();
    // Giữ tên đã nhập ở giai đoạn 4, nếu tab hiện tại vẫn còn tên đó.
    try {
      cart.customerName =
        sessionStorage
          .getItem(`restaurant_qr_customer_name:${qrToken}`)
          ?.trim()
          .slice(0, 100) || '';
    } catch {
      /* Có thể chưa có tên. */
    }
    return cart;
  }
  const cart = JSON.parse(raw);
  if (
    cart?.version !== 1 ||
    typeof cart.customerName !== 'string' ||
    cart.customerName.length > 100 ||
    !Array.isArray(cart.items) ||
    cart.items.length > 50 ||
    typeof cart.note !== 'string' ||
    cart.note.length > 1000 ||
    !Array.isArray(cart.orders) ||
    !cart.items.every(
      (item) =>
        item &&
        idPattern.test(item.productId) &&
        typeof item.productName === 'string' &&
        typeof item.imageUrl === 'string' &&
        Number.isSafeInteger(item.unitPrice) &&
        item.unitPrice >= 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 99 &&
        typeof item.note === 'string' &&
        item.note.length <= 500,
    ) ||
    (cart.pending !== null &&
      (!cart.pending ||
        !secretPattern.test(cart.pending.requestId) ||
        cart.pending.qrToken !== qrToken ||
        !Array.isArray(cart.pending.items))) ||
    !cart.orders.every(
      (order) =>
        order &&
        idPattern.test(order.orderId) &&
        secretPattern.test(order.trackingToken) &&
        typeof order.orderCode === 'string',
    )
  ) {
    throw new Error('Dữ liệu giỏ trong trình duyệt không hợp lệ.');
  }
  return cart;
}

export function writeCart(qrToken, cart) {
  localStorage.setItem(cartKey(qrToken), JSON.stringify(cart));
}

export function newRequestId() {
  // getRandomValues cũng dùng được khi demo qua địa chỉ HTTP trong mạng LAN.
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function findSavedOrder(orderId) {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('restaurant_qr_cart:v1:')) continue;
    const qrToken = key.slice('restaurant_qr_cart:v1:'.length);
    try {
      const order = readCart(qrToken).orders.find(
        (order) => order.orderId === orderId,
      );
      if (order) return { ...order, qrToken };
    } catch {
      /* Một giỏ lỗi không ngăn tìm đơn ở bàn khác. */
    }
  }
  return null;
}
