export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
  PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY",
}

export type SensitivePersonalData = {
  first_name: string;
  last_name: string;
  contact_email: string;
  phone_number: string;
  address: string;
  gender: Gender;
};
