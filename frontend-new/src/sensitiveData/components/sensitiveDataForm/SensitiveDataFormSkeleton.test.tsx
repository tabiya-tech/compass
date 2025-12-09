import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import SensitiveDataFormSkeleton, { DATA_TEST_ID } from "./SensitiveDataFormSkeleton";
import { render, screen } from "src/_test_utilities/test-utils";

test("should render the SensitiveDataFormSkeleton", () => {
    // WHEN the SensitiveDataFormSkeleton is rendered
    render(<SensitiveDataFormSkeleton />)

    // THEN expect no errors or warnings 
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()

    // AND expect it to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_SKELETON)).toMatchSnapshot()
})