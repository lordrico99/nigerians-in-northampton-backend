export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) return next(error);

  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'One of the uploaded files is too large.' });
  }

  if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Unexpected upload field or too many files.' });
  }

  if (error?.name === 'MulterError') {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error?.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Database validation failed.',
      errors: Object.values(error.errors).map((item) => item.message),
    });
  }

  const status = Number(error?.statusCode || error?.status || 500);
  res.status(status >= 400 && status <= 599 ? status : 500).json({
    success: false,
    message: error?.message || 'Internal server error.',
  });
}
