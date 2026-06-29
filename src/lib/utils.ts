import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes, resolving conflicts (e.g. conditional padding overrides). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
