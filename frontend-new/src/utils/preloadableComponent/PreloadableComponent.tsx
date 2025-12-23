import { lazy, FC } from "react";

export type PreloadableComponent<T extends FC<any>> = T & {
  preload: () => Promise<{ default: T }>;
};

/**
 * A higher order component that wraps a lazy loaded component and adds a preload function to it.
 * Only works with functional components that are exported as default.
 *
 * @param factory A function that returns a promise that resolves to the component.
 * @returns A component that can be lazy loaded and preloaded.
 * @example const MyComponent = lazyWithPreload(() => import("path/to/component"));
 * */
export function lazyWithPreload<T extends FC<any>>(factory: () => Promise<{ default: T }>): PreloadableComponent<T> {
  const Component = lazy(factory);
  const PreloadableComponent = Component as unknown as PreloadableComponent<T>;

  PreloadableComponent.preload = factory;
  return PreloadableComponent;
}
