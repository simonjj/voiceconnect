import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  authToken: process.env.AUTH_TOKEN || 'dev-token',
  sttUrl: process.env.STT_URL || 'ws://localhost:8001',
  ttsUrl: process.env.TTS_URL || 'http://localhost:8002',
  dbPath: process.env.DB_PATH || resolve(import.meta.dirname, '../connect-store.json'),
};
