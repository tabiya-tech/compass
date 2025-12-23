export type DebouncedFunction<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};
/**
 * debounce function that delays the execution of the provided function until after a specified delay.
 * */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };
  return debounced;
}
