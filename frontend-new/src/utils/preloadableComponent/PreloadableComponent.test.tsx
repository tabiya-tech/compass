import "src/_test_utilities/consoleMock";
import { useEffect, Suspense } from "react";
import { lazyWithPreload } from "./PreloadableComponent";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";

interface TestComponentProps {
  foo: string;
  children: string;
}

/* A module that returns a test component and various stats about the test component */
function getTestComponentModule() {
  let loaded = false;
  let loadCalls = 0;
  let renders = 0;
  let mounts = 0;

  function OriginalComponent(props: TestComponentProps) {
    renders++; // count renders
    useEffect(() => {
      mounts++; // count mounts
    }, []);
    return <div>{`${props.foo} ${props.children}`}</div>;
  }

  return {
    isLoaded: () => loaded,
    loadCalls: () => loadCalls,
    renders: () => renders,
    mounts: () => mounts,
    TestComponent: async () => {
      loaded = true;
      loadCalls++;
      // a default export of the original component
      return { default: OriginalComponent };
    },
  };
}

describe("PreloadableComponent", () => {
  test("should render a component lazily when preload function is not invoked", async () => {
    // GIVEN a test component
    const { TestComponent, isLoaded, mounts } = getTestComponentModule();
    // AND the component is wrapped with lazyWithPreload
    const PreloadableComponent = lazyWithPreload(TestComponent);
    // guard: expect the component not to be loaded until it is rendered
    expect(isLoaded()).toBe(false);

    // WHEN the component is rendered
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <PreloadableComponent foo="bar">baz</PreloadableComponent>
      </Suspense>
    );

    // THEN expect the loading fallback to be shown first
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // AND the component to eventually be loaded
    await waitFor(() => {
      expect(isLoaded()).toBe(true);
    });

    // THEN expect the actual component to be rendered
    await waitFor(() => {
      expect(screen.getByText("bar baz")).toBeInTheDocument();
    });

    // AND expect the loading fallback to be gone
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // AND expect the component to be mounted once
    expect(mounts()).toBe(1);
    // AND expect no errors or warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render a component lazily when preload function is invoked", async () => {
    // GIVEN a test component
    const { TestComponent, isLoaded, mounts, loadCalls } = getTestComponentModule();
    // AND the component is wrapped with lazyWithPreload
    const PreloadableComponent = lazyWithPreload(TestComponent);

    // WHEN the preload function is invoked
    await PreloadableComponent.preload();

    // THEN expect the component to eventually be loaded but not mounted
    await waitFor(() => {
      expect(isLoaded()).toBe(true);
    });
    expect(mounts()).toBe(0);

    // AND WHEN the component is rendered
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <PreloadableComponent foo="bar">baz</PreloadableComponent>
      </Suspense>
    );

    // THEN expect the loading fallback to be shown (since the component is already loaded)
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // AND the component to eventually be loaded
    await waitFor(() => {
      expect(isLoaded()).toBe(true);
    });

    // THEN expect the actual component to be rendered
    await waitFor(() => {
      expect(screen.getByText("bar baz")).toBeInTheDocument();
    });

    // AND expect the component to be mounted once
    expect(mounts()).toBe(1);
    // AND expect the component to have been loaded twice
    // once when the preload function was invoked and once when the component was rendered
    // this is important since in the case the preload fails, the component will be loaded again when rendered
    // and if the preload was successful, the component will be cached by the browser
    expect(loadCalls()).toBe(2);

    // AND expect no errors or warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
