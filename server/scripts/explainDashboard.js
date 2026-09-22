import mongoose from 'mongoose';
import { dashboardRange } from '../src/utils/dashboardRange.js';
import {
  paidOrderFilter,
  createdOrderFilter,
} from '../src/services/dashboardService.js';

// Chỉ đọc: không syncIndexes/createIndexes; kết quả phản ánh index đang có thật.
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5000,
  });
  const range = dashboardRange(
    { from: '2026-09-17', to: '2026-09-17' },
    new Date('2026-09-17T13:00:00Z'),
  );
  const collection = mongoose.connection.db.collection('orders');
  for (const [query, filter] of Object.entries({
    revenue: paidOrderFilter(range),
    totalOrders: createdOrderFilter(range),
  })) {
    const result = await collection.find(filter).explain('executionStats');
    console.log(
      JSON.stringify(
        {
          query,
          database: mongoose.connection.name,
          winningPlan: result.queryPlanner.winningPlan,
          returned: result.executionStats.nReturned,
          documentsExamined: result.executionStats.totalDocsExamined,
          keysExamined: result.executionStats.totalKeysExamined,
        },
        null,
        2,
      ),
    );
  }
} catch {
  console.error(
    'Không đọc được explain. Kiểm tra MongoDB và cấu hình; không in URI.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
