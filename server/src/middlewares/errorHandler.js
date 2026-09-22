import HttpError from '../utils/HttpError.js';

const databaseConnectionErrors = new Set([
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'MongoServerClosedError',
  'MongoPoolClearedError',
]);

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'API không tồn tại.',
  });
}

// Express nhận diện middleware xử lý lỗi qua đủ bốn tham số.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  // Mongoose có thể đợi query trong bộ đệm khi DB vừa mất kết nối.
  // Chỉ nhận đúng lỗi kết nối/bộ đệm, không biến mọi lỗi lập trình thành 503.
  if (
    databaseConnectionErrors.has(error.name) ||
    (error.name === 'MongooseError' && /buffering timed out after \d+ms/.test(error.message))
  ) {
    console.error('Yêu cầu thất bại: chưa kết nối được MongoDB (HTTP 503).');
    return res.status(503).json({
      success: false,
      message: 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.',
    });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường.' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: 'Dữ liệu bị trùng. Vui lòng thử lại.' });
  }

  const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 500;
  const messages = {
    400: 'Dữ liệu JSON không hợp lệ.',
    413: 'Dữ liệu gửi lên vượt quá giới hạn cho phép.',
    500: 'Có lỗi xảy ra trên máy chủ.',
  };

  // Không trả stack trace hoặc thông tin cấu hình nhạy cảm về trình duyệt.
  console.error(`Yêu cầu thất bại (HTTP ${status}).`);
  res.status(status).json({ success: false, message: messages[status] });
}
