import mongoose from 'mongoose';

// Chỉ đọc collection gốc, không qua model: Mongoose không được ép paidAt string thành Date.
// Không tạo index, không sửa dữ liệu, không nằm trong API dashboard.
const counters = {
  completedWithoutPaidAt: 0,
  itemsWithWrongLineTotal: 0,
  ordersWithWrongTotal: 0,
  itemsWithoutProductId: 0,
};
const examples = Object.fromEntries(
  Object.keys(counters).map((key) => [key, []]),
);
function record(key, order, itemIndex) {
  counters[key] += 1;
  if (examples[key].length < 10) {
    examples[key].push({
      orderId: String(order._id),
      orderCode: order.orderCode,
      status: order.status,
      createdAt: order.createdAt,
      ...(itemIndex === undefined ? {} : { itemIndex }),
    });
  }
}

try {
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI');
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5000,
  });
  const collection = mongoose.connection.db.collection('orders');
  let ordersChecked = 0;
  let itemsChecked = 0;
  const cursor = collection.find(
    {},
    {
      projection: {
        orderCode: 1,
        status: 1,
        paidAt: 1,
        createdAt: 1,
        items: 1,
        totalAmount: 1,
      },
      batchSize: 200,
    },
  );
  for await (const order of cursor) {
    ordersChecked += 1;
    if (
      order.status === 'completed' &&
      (!(order.paidAt instanceof Date) ||
        !Number.isFinite(order.paidAt.getTime()))
    ) {
      record('completedWithoutPaidAt', order);
    }
    const items = Array.isArray(order.items) ? order.items : [];
    let sum = 0;
    let validAmounts = Array.isArray(order.items) && items.length > 0;
    for (const [index, item] of items.entries()) {
      itemsChecked += 1;
      const numeric =
        item &&
        [item.unitPrice, item.quantity, item.lineTotal].every(
          Number.isSafeInteger,
        );
      if (!numeric || item.lineTotal !== item.unitPrice * item.quantity) {
        record('itemsWithWrongLineTotal', order, index);
      }
      if (!item?.productId) record('itemsWithoutProductId', order, index);
      if (!Number.isSafeInteger(item?.lineTotal)) validAmounts = false;
      else sum += item.lineTotal;
    }
    if (
      !validAmounts ||
      !Number.isSafeInteger(order.totalAmount) ||
      order.totalAmount !== sum
    ) {
      record('ordersWithWrongTotal', order);
    }
  }
  const passed = Object.values(counters).every((count) => count === 0);
  console.log(
    JSON.stringify(
      {
        source: { database: mongoose.connection.name, collection: 'orders' },
        readOnly: true,
        ordersChecked,
        itemsChecked,
        counters,
        examples,
        passed,
      },
      null,
      2,
    ),
  );
  if (!passed) {
    console.error(
      'DỪNG triển khai dashboard: cần người dùng quyết định cách xử lý dữ liệu. Không tự backfill.',
    );
    process.exitCode = 2;
  }
} catch {
  console.error(
    'Không kiểm tra được dữ liệu. Kiểm tra MONGODB_URI và MongoDB; không in chuỗi kết nối.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
