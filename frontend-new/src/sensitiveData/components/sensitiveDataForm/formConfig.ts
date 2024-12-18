import { SensitivePersonalData } from "src/sensitiveData/types";

type FieldConfig = {
  maxLength?: number;
};

export const formConfig: Record<keyof SensitivePersonalData, FieldConfig> = {
  first_name: {
    maxLength: 32,
  },
  last_name: {
    maxLength: 32,
  },
  contact_email: {
    maxLength: 256,
  },
  phone_number: {
    maxLength: 20,
  },
  address: {
    maxLength: 25,
  },
  gender: {},
};

export const DEBOUNCE_TIME = 250;
