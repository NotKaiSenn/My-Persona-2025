export const FOLDER_PREVIEW_LIMIT = 6;

export function folderPreviews<T>(items: readonly T[]): T[] {
  return items.slice(0, FOLDER_PREVIEW_LIMIT);
}
