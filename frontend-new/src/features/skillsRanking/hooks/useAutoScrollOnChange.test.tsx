// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import { useAutoScrollOnChange } from "./useAutoScrollOnChange";

describe("useAutoScrollOnChange", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const TestComponent: React.FC<{ dep: number }> = ({ dep }) => {
    const ref = useAutoScrollOnChange(dep);
    return (
      <div data-testid="auto-scroll-root">
        <div ref={ref} data-testid="auto-scroll-anchor" />
      </div>
    );
  };

  test("should call scrollIntoView on mount and again when dependency changes", () => {
    // GIVEN an initial render
    const { rerender } = render(<TestComponent dep={0} />);
    const anchor = screen.getByTestId("auto-scroll-anchor");
    expect(anchor).toBeInTheDocument();
    // THEN called once on mount
    expect(anchor.scrollIntoView).toHaveBeenCalledTimes(1);

    // WHEN the dependency changes
    (anchor.scrollIntoView as jest.Mock).mockClear();
    rerender(<TestComponent dep={1} />);

    // THEN expect scrollIntoView to be called with smooth behavior
    expect(anchor.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(anchor.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
