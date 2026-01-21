import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

export class CacheStorage {
  constructor(private readonly baseDir = path.join(process.cwd(), '.mpr-cache')) {}

  async read(key: string): Promise<string | null> {
    const file = path.join(this.baseDir, `${key}.json`);
    try {
      return await fs.readFile(file, 'utf8');
    } catch {
      return null;
    }
  }

  async write(key: string, value: string): Promise<void> {
    const file = path.join(this.baseDir, `${key}.json`);
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(file, value, 'utf8');
    logger.info(`Cached results at ${file}`);
  }
}
