import { randomBytes } from 'node:crypto';
import Order from '../models/Order.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import HttpError from '../utils/HttpError.js';
import { notifyOrderCreated } from '../sockets/notifications.js';
import { validateOrder } from '../utils/orderValidation.js';
import {
  hashValue,
  makeTrackingToken,
  matchesTrackingToken,
} from '../utils/orderToken.js';

function creationResult(order, replayed) {
  const trackingToken = makeTrackingToken(order.trackingTokenNonce);
  if (!matchesTrackingToken(trackingToken, order.trackingTokenHash)) {
    throw new HttpError(
      503,
      'Chưa khôi phục được mã xem đơn. Vui lòng liên hệ nhân viên; không gửi lại bằng giỏ mới.',
    );
  }
  return {
    replayed,
    data: {
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      trackingToken,
    },
  };
}

export async function createGuestOrder(body) {
  const input = validateOrder(body);
  const requestIdHash = hashValue(body.requestId);
  const requestPayloadHash = hashValue(JSON.stringify(input));
  // Chờ unique index sẵn sàng, kể cả ngay lần khởi động đầu tiên.
  await Order.init();
  async function findPrevious() {
    const previous = await Order.findOne({ requestIdHash }).select(
      '+requestPayloadHash +trackingTokenHash +trackingTokenNonce',
    );
    if (!previous) return null;
    if (previous.requestPayloadHash !== requestPayloadHash) {
      throw new HttpError(
        409,
        'Mã lần gửi đã dùng cho nội dung khác. Hãy kiểm tra đơn đã gửi.',
      );
    }
    return creationResult(previous, true);
  }
  // Kiểm tra đơn cũ trước menu: đổi giá/tắt món sau khi đặt không cản trở retry.
  const previous = await findPrevious();
  if (previous) return previous;

  const table = await Table.findOne({ qrToken: input.qrToken });
  if (!table)
    throw new HttpError(404, 'Mã QR không hợp lệ hoặc bàn không tồn tại.');
  if (!table.isActive)
    throw new HttpError(
      403,
      'Bàn này hiện không phục vụ. Vui lòng liên hệ nhân viên.',
    );
  const products = await Product.find({
    _id: { $in: input.items.map((item) => item.productId) },
  }).lean();
  const categories = await Category.find({
    _id: { $in: products.map((product) => product.categoryId) },
    isActive: true,
  }).select('_id');
  const activeCategories = new Set(categories.map((category) => category.id));
  let totalAmount = 0;
  const items = input.items.map((item) => {
    const product = products.find(
      (product) => product._id.toString() === item.productId,
    );
    if (!product)
      throw new HttpError(
        400,
        'Một món trong giỏ không còn tồn tại. Hãy xóa món và xem lại menu.',
      );
    if (
      !product.isActive ||
      !activeCategories.has(product.categoryId.toString())
    ) {
      throw new HttpError(
        400,
        `Món ${product.name} hiện không phục vụ. Hãy xóa món khỏi giỏ.`,
      );
    }
    if (!product.isAvailable)
      throw new HttpError(
        400,
        `Món ${product.name} đã tạm hết. Hãy xóa món khỏi giỏ.`,
      );
    const lineTotal = product.price * item.quantity;
    totalAmount += lineTotal;
    if (
      !Number.isSafeInteger(product.price) ||
      product.price < 0 ||
      !Number.isSafeInteger(lineTotal) ||
      !Number.isSafeInteger(totalAmount)
    ) {
      throw new HttpError(
        400,
        'Tổng tiền vượt giới hạn tính toán. Vui lòng liên hệ nhân viên.',
      );
    }
    return {
      productId: product._id,
      productName: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
      note: item.note,
      lineTotal,
    };
  });

  const trackingTokenNonce = randomBytes(32).toString('hex');
  const trackingTokenHash = hashValue(makeTrackingToken(trackingTokenNonce));
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replaceAll('-', '');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const order = await Order.create({
        orderCode: `ORD-${date}-${randomBytes(5).toString('hex').toUpperCase()}`,
        customerName: input.customerName,
        tableId: table._id,
        tableName: table.name,
        items,
        note: input.note,
        totalAmount,
        status: 'pending',
        trackingTokenHash,
        trackingTokenNonce,
        requestIdHash,
        requestPayloadHash,
        statusHistory: [{ status: 'pending', changedAt: now, changedBy: null }],
      });
      // Chỉ nhánh vừa ghi MongoDB mới phát event; trả lại requestId cũ không đi qua đây.
      await notifyOrderCreated(order);
      return creationResult(order, false);
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Hai request đồng thời: DB chỉ cho lưu một, request còn lại lấy đúng đơn đó.
      const duplicate = await findPrevious();
      if (duplicate) return duplicate;
      if (!error.keyPattern?.orderCode) throw error;
    }
  }
  throw new HttpError(
    503,
    'Chưa tạo được mã đơn. Vui lòng thử lại cùng lần gửi.',
  );
}
