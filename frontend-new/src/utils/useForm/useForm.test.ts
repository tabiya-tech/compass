import { useForm } from "src/utils/useForm/useForm";
import { renderHook, act } from "src/_test_utilities/test-utils";
import { getRandomString } from "src/_test_utilities/specialCharacters";

// Define a test data type
type TestData = {
  name: string;
  email: string;
};

describe("useForm", () => {
  const fields = {
    name: { required: true, defaultValue: "" },
    email: { required: true, defaultValue: "" },
  };

  it("should initialize with default values", () => {
    // GIVEN a form with fields
    // WHEN the hook is called
    const { result } = renderHook(() => useForm<TestData>({ fields }));

    // THEN the form should be initialized with default values
    expect(result.current.values).toEqual({ name: "", email: "" });

    // AND the form should be initialized with no errors
    expect(result.current.errors).toEqual({ name: null, email: null });

    // AND the form should be marked as invalid
    expect(result.current.isFormValid).toBe(false);
  });

  it("should update a field value and validate it", () => {
    // GIVEN a form with fields
    // WHEN the hook is called
    const { result } = renderHook(() => useForm<TestData>({ fields }));

    // AND a field value is updated
    act(() => {
      result.current.setValue("name", "John");
    });

    // THEN the field value should be updated
    expect(result.current.values.name).toBe("John");

    // AND the field should be marked as valid
    expect(result.current.errors.name).toBe(null);
  });

  it("should set an error for a required field left empty", () => {
    // GIVEN a form with fields
    // WHEN the hook is called
    const { result } = renderHook(() => useForm<TestData>({ fields }));

    // AND a required field is left empty
    act(() => {
      result.current.setValue("name", "");
    });

    // THEN the field should be marked
    // AND the field should be marked as invalid
    expect(result.current.values.name).toBe("");
    expect(result.current.errors.name).toBe("This field is required.");
  });

  it("should make the field as not valid if only spaces are entered", () => {
    // GIVEN a form with fields
    // WHEN the hook is called
    const { result } = renderHook(() => useForm<TestData>({ fields }));

    // AND a field is filled with spaces
    act(() => {
      result.current.setValue("name", "    ");
    });

    // THEN the field should be marked as invalid
    expect(result.current.errors.name).toBe("This field is required.");
  })

  it("should mark the form as valid if all required fields are filled", () => {
    // GIVEN a form with fields
    // WHEN the hook is called
    const { result } = renderHook(() => useForm<TestData>({ fields }));

    // AND all required fields are filled
    act(() => {
      result.current.setValue("name", getRandomString(100));
      result.current.setValue("email", getRandomString(10));
    });

    // THEN the form should be marked as valid
    expect(result.current.isFormValid).toBe(true);
  });

  it("should generate correct field props", () => {
    // GIVEN a form with fields
    // WHEN the hook is called
    const { result } = renderHook(() => useForm<TestData>({ fields }));
    const givenNewValue = getRandomString(10);

    // THEN the field props should be generated correctly
    const { name, email } = result.current.fieldFormProps;

    // AND the field props should contain the correct values
    expect(name.value).toBe("");
    expect(email.value).toBe("");

    // AND the field props should contain the correct onChange
    expect(typeof name.onChange).toBe("function");
    expect(typeof email.onChange).toBe("function");

    // WHEN a field value is updated
    act(() => {
      name.onChange({ target: { value: givenNewValue } } as React.ChangeEvent<HTMLInputElement>);
    });

    // THEN the field value should be
    expect(result.current.values.name).toBe(givenNewValue);
  });
});
