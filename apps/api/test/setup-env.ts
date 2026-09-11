import path from 'path';
import dotenv from 'dotenv';

// Jest runs from apps/api; the workspace .env lives two levels up at the repo root.
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
