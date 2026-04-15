import { CSSClampFnCalculatorPx, CSSClampFnCalculatorRem, ScreenSize } from "./CSSClampFnCalculator";

describe("CSSClampFnCalculatorPx", () => {
  let originalCss: unknown;
  const getSupportsMock = () => (global as unknown as { CSS: { supports: jest.Mock } }).CSS.supports;

  beforeEach(() => {
    originalCss = (global as unknown as { CSS?: unknown }).CSS;
    (global as unknown as { CSS: { supports: jest.Mock } }).CSS = { supports: jest.fn().mockReturnValue(true) };
  });

  afterEach(() => {
    if (typeof originalCss === "undefined") {
      delete (global as unknown as { CSS?: unknown }).CSS;
      return;
    }
    (global as unknown as { CSS?: unknown }).CSS = originalCss;
  });

  test("should return a CSS clamp function", () => {
    // GIVEN a minimum value in pixel
    const givenMinValue = 8;
    // AND a maximum value in pixel
    const givenMaxValue = 16;
    // AND a screen size in pixel
    const givenScreenPx: ScreenSize = {
      minWidth: 800,
      maxWidth: 1200,
      minHeight: 500,
      maxHeight: 800,
    };

    // WHEN the function "CSSClampFnCalculator" is called with the above values
    const actualCssClampFn = CSSClampFnCalculatorPx(givenMinValue, givenMaxValue, givenScreenPx);

    // THEN expect a string representing the CSS clamp function to be returned
    expect(actualCssClampFn).toEqual("clamp(8px, calc((2.67vh + -5.35px + 2vw + -8px)/2), 16px)");
  });

  test("should use dvh/dvw when dynamic viewport units are requested", () => {
    // GIVEN a screen size in pixel
    const givenScreenPx: ScreenSize = {
      minWidth: 800,
      maxWidth: 1200,
      minHeight: 500,
      maxHeight: 800,
    };

    // WHEN the function "CSSClampFnCalculatorPx" is called with dynamic viewport units enabled
    const actualCssClampFn = CSSClampFnCalculatorPx(8, 16, givenScreenPx, true);

    // THEN expect a string using dvh/dvw to be returned
    expect(actualCssClampFn).toEqual("clamp(8px, calc((2.67dvh + -5.35px + 2dvw + -8px)/2), 16px)");
  });

  test("should fallback to vh/vw when dynamic units are requested but not supported", () => {
    // GIVEN CSS support for dynamic viewport units is not available
    getSupportsMock().mockReturnValue(false);
    // AND a screen size in pixel
    const givenScreenPx: ScreenSize = {
      minWidth: 800,
      maxWidth: 1200,
      minHeight: 500,
      maxHeight: 800,
    };

    // WHEN the function "CSSClampFnCalculatorPx" is called with dynamic viewport units enabled
    const actualCssClampFn = CSSClampFnCalculatorPx(8, 16, givenScreenPx, true);

    // THEN expect a string using vh/vw to be returned
    expect(actualCssClampFn).toEqual("clamp(8px, calc((2.67vh + -5.35px + 2vw + -8px)/2), 16px)");
  });
});

describe("CSSClampFnCalculatorRem", () => {
  let originalCss: unknown;
  const getSupportsMock = () => (global as unknown as { CSS: { supports: jest.Mock } }).CSS.supports;

  beforeEach(() => {
    originalCss = (global as unknown as { CSS?: unknown }).CSS;
    (global as unknown as { CSS: { supports: jest.Mock } }).CSS = { supports: jest.fn().mockReturnValue(true) };
  });

  afterEach(() => {
    if (typeof originalCss === "undefined") {
      delete (global as unknown as { CSS?: unknown }).CSS;
      return;
    }
    (global as unknown as { CSS?: unknown }).CSS = originalCss;
  });

  test("should return a CSS clamp function", () => {
    // GIVEN a minimum value in pixel
    const givenMinValue = 0.5;
    // AND a maximum value in pixel
    const givenMaxValue = 1.5;
    // AND a screen size in pixel
    const givenScreenPx: ScreenSize = {
      minWidth: 800 / 16,
      maxWidth: 1200 / 16,
      minHeight: 500 / 16,
      maxHeight: 800 / 16,
    };

    // WHEN the function "CSSClampFnCalculator" is called with the above values
    const actualCssClampFn = CSSClampFnCalculatorRem(givenMinValue, givenMaxValue, givenScreenPx);

    // THEN expect a string representing the CSS clamp function to be returned
    expect(actualCssClampFn).toEqual("clamp(0.5rem, calc((5.33vh + -1.17rem + 4vw + -1.5rem)/2), 1.5rem)");
  });

  test("should use dvh/dvw in rem when dynamic viewport units are requested", () => {
    // GIVEN a screen size in pixel
    const givenScreenPx: ScreenSize = {
      minWidth: 800 / 16,
      maxWidth: 1200 / 16,
      minHeight: 500 / 16,
      maxHeight: 800 / 16,
    };

    // WHEN the function "CSSClampFnCalculatorRem" is called with dynamic viewport units enabled
    const actualCssClampFn = CSSClampFnCalculatorRem(0.5, 1.5, givenScreenPx, true);

    // THEN expect a string using dvh/dvw to be returned
    expect(actualCssClampFn).toEqual("clamp(0.5rem, calc((5.33dvh + -1.17rem + 4dvw + -1.5rem)/2), 1.5rem)");
  });

  test("should fallback to vh/vw in rem when dynamic units are requested but not supported", () => {
    // GIVEN CSS support for dynamic viewport units is not available
    getSupportsMock().mockReturnValue(false);
    // AND a screen size in pixel
    const givenScreenPx: ScreenSize = {
      minWidth: 800 / 16,
      maxWidth: 1200 / 16,
      minHeight: 500 / 16,
      maxHeight: 800 / 16,
    };

    // WHEN the function "CSSClampFnCalculatorRem" is called with dynamic viewport units enabled
    const actualCssClampFn = CSSClampFnCalculatorRem(0.5, 1.5, givenScreenPx, true);

    // THEN expect a string using vh/vw to be returned
    expect(actualCssClampFn).toEqual("clamp(0.5rem, calc((5.33vh + -1.17rem + 4vw + -1.5rem)/2), 1.5rem)");
  });
});
