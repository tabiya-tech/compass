import { debounce } from './debounce';

jest.useFakeTimers();

describe('debounce', () => {
  it('delays execution by the specified time', () => {
    // GIVEN a function and a debounced version with 200ms delay
    const fn = jest.fn();
    const debounced = debounce(fn, 200);
    // WHEN the debounced function is called
    debounced('a');
    // THEN the function should not be called immediately
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    // WHEN the delay has passed
    jest.advanceTimersByTime(1);
    // THEN the function should be called with the last argument
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('only executes the last call if called multiple times quickly', () => {
    // GIVEN a function and a debounced version with 100ms delay
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    // WHEN the debounced function is called multiple times quickly
    debounced('a');
    debounced('b');
    debounced('c');
    jest.advanceTimersByTime(100);
    // THEN only the last call should be executed
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('cancels pending execution', () => {
    // GIVEN a function and a debounced version with 100ms delay
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    // WHEN the debounced function is called and then cancelled
    debounced('a');
    debounced.cancel();
    jest.advanceTimersByTime(100);
    // THEN the function should not be called
    expect(fn).not.toHaveBeenCalled();
  });

  it('works with different argument types', () => {
    // GIVEN a function and a debounced version
    const fn = jest.fn();
    const debounced = debounce(fn, 50);
    // WHEN the debounced function is called with multiple arguments
    debounced(1, 2, 3);
    jest.advanceTimersByTime(50);
    // THEN the function should be called with those arguments
    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });

  it('works with zero delay', () => {
    // GIVEN a function and a debounced version with 0ms delay
    const fn = jest.fn();
    const debounced = debounce(fn, 0);
    // WHEN the debounced function is called
    debounced('x');
    // THEN the function should not be called immediately
    expect(fn).not.toHaveBeenCalled();
    // WHEN the delay has passed (0ms)
    jest.advanceTimersByTime(0);
    // THEN the function should be called
    expect(fn).toHaveBeenCalledWith('x');
  });

  it('works with async functions', async () => {
    // GIVEN an async function and a debounced version
    const fn = jest.fn(async (x) => x + 1);
    const debounced = debounce(fn, 100);
    // WHEN the debounced function is called
    debounced(5);
    jest.advanceTimersByTime(100);
    // THEN the function should be called with the argument
    await Promise.resolve();
    expect(fn).toHaveBeenCalledWith(5);
  });

  it('does not support immediate execution (documented)', () => {
    // GIVEN a function and a debounced version
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    // WHEN the debounced function is called
    debounced('a');
    // THEN the function should not be called immediately
    expect(fn).not.toHaveBeenCalled();
    // WHEN the delay has passed
    jest.advanceTimersByTime(100);
    // THEN the function should be called
    expect(fn).toHaveBeenCalledWith('a');
  });
}); 