export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
  PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY",
}

export interface StoredPersonalInfo {
  fullName: string;
  phoneNumber: string;
  contactEmail: string;
  address: string;
}

export type SensitivePersonalData = Omit<StoredPersonalInfo, "fullName"> & {
  firstName: string;
  lastName: string;
  gender: Gender;
};
// since we are sending this to the backend there is a naming convention for fields to be snake case
// all fields that cross a boundary from f.e -> b.e or vice versa should in be in snake case
export type SensitivePersonalDataRequest = {
  first_name: string;
  last_name: string;
  contact_email: string;
  phone_number: string;
  address: string;
  gender: Gender
}