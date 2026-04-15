export type ScreenSize = {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
};

/**
 * True when the browser understands dynamic viewport units (`dvh` / `dvw`). When false, use `vh`/`vw`
 * in clamp expressions so older engines do not drop the whole rule.
 */
export function supportsDynamicViewportUnits(): boolean {
  if (globalThis.window === undefined) {
    return false;
  }
  try {
    return (CSS.supports?.("height", "1dvh") ?? false) && (CSS.supports?.("width", "1dvw") ?? false);
  } catch {
    return false;
  }
}

/**
 * Generates a CSS clamp function that calculates a value that linearly scales between a minimum and maximum
 * value based on the current viewport size falling within specified screen dimensions.
 *
 * @param unit - The unit to use for the resulting CSS value (e.g., "rem" or "px").
 * @param minValue - The minimum value to clamp.
 * @param maxValue - The maximum value to clamp.
 * @param screenSize - An object representing the minimum and maximum dimensions of the screen.
 * @param useDynamicViewportUnits - When true (and supported at runtime), emit `dvh`/`dvw`; otherwise `vh`/`vw`.
 *
 * @returns - A CSS clamp function as a string, ready to be used in your stylesheets.
 */
function CSSClampFnCalculator(
  unit: "rem" | "px",
  minValue: number,
  maxValue: number,
  screenSize: ScreenSize,
  useDynamicViewportUnits: boolean
): string {
  const dynamicOk = useDynamicViewportUnits && supportsDynamicViewportUnits();
  const vh = dynamicOk ? "dvh" : "vh";
  const vw = dynamicOk ? "dvw" : "vw";
  // height
  const heightScaleFactor: number = round(
    ((maxValue - minValue) / (screenSize.maxHeight - screenSize.minHeight + Number.EPSILON)) * 100
  );
  const heightOffset: number = round(minValue - (heightScaleFactor / 100) * screenSize.minHeight);
  const heightPart: string = `${heightScaleFactor}${vh} + ${heightOffset}${unit}`;
  // width
  const widthScaleFactor: number = round(
    ((maxValue - minValue) / (screenSize.maxWidth - screenSize.minWidth + Number.EPSILON)) * 100
  );
  const widthOffset: number = round(minValue - (widthScaleFactor / 100) * screenSize.minWidth);
  const widthPart: string = `${widthScaleFactor}${vw} + ${widthOffset}${unit}`;

  // consider both the height and width scale factors
  return `clamp(${minValue}${unit}, calc((${heightPart} + ${widthPart})/2), ${maxValue}${unit})`;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function CSSClampFnCalculatorRem(
  minValue: number,
  maxValue: number,
  screenSize: ScreenSize,
  useDynamicViewportUnits = false
) {
  return CSSClampFnCalculator("rem", minValue, maxValue, screenSize, useDynamicViewportUnits);
}

export function CSSClampFnCalculatorPx(
  minValue: number,
  maxValue: number,
  screenSize: ScreenSize,
  useDynamicViewportUnits = false
) {
  return CSSClampFnCalculator("px", minValue, maxValue, screenSize, useDynamicViewportUnits);
}
