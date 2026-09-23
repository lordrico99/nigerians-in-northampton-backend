import path from 'node:path';

export function publicFileUrl(baseUrl, filename) {
  return `${baseUrl}/uploads/businesses/${encodeURIComponent(filename)}`;
}

export function fileRecord(file, baseUrl) {
  if (!file) return null;
  return {
    filename: file.filename,
    url: publicFileUrl(baseUrl, file.filename),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export function safeExtension(filename) {
  return path.extname(filename || '').toLowerCase();
}
