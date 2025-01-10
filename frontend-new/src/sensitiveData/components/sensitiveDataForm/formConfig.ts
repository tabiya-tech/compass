import { SensitivePersonalData } from "src/sensitiveData/types";

type FieldConfig = {
  maxLength?: number;
};

export const formConfig: Record<keyof SensitivePersonalData, FieldConfig> = {
  firstName: {
    maxLength: 32,
  },
  lastName: {
    maxLength: 32,
  },
  contactEmail: {
    maxLength: 256,
  },
  phoneNumber: {
    maxLength: 20,
  },
  address: {
    maxLength: 25,
  },
  gender: {},
};

export const DEBOUNCE_TIME = 250;
