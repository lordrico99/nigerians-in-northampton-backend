import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const required = [
  'MONGODB_URI',
  'ADMIN_API_KEY'
];

for (const key of required) {
  if (
    !process.env[key] ||
    process.env[key].includes('YOUR_') ||
    process.env[key].includes('replace-with')
  ) {
    console.warn(
      `Warning: ${key} is missing or still uses a placeholder value.`
    );
  }
}

export const env = {
  nodeEnv:
    process.env.NODE_ENV || 'development',

  port:
    Number(process.env.PORT || 5000),

  mongoUri:
    process.env.MONGODB_URI || '',

  frontendOrigins:
    (
      process.env.FRONTEND_ORIGIN ||
      'http://127.0.0.1:5500,http://localhost:5500'
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),

  adminApiKey:
    process.env.ADMIN_API_KEY || '',

  publicBaseUrl:
    (
      process.env.PUBLIC_BASE_URL ||
      'http://localhost:5000'
    ).replace(/\/$/, ''),

  uploadDir:
    path.resolve(
      process.env.UPLOAD_DIR ||
      'uploads/businesses'
    ),

  maxFileSizeMb:
    Number(
      process.env.MAX_FILE_SIZE_MB || 5
    ),
};