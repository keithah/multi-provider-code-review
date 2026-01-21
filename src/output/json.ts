import { Review } from '../types';

export function buildJson(review: Review): string {
  return JSON.stringify(review, null, 2);
}
