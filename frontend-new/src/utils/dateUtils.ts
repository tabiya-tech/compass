import { getDatePattern, getDateSplitter } from "../envService";

export type DatePattern = "YYYY/MM" | "YYYY-MM" | "MM-YYYY";

export const cvFormatDate = (
  date?: string,
  pattern?: DatePattern
): string => {
  if (!date) return "";

  
  const envPattern = (getDatePattern() as DatePattern) ?? "YYYY/MM";
  const finalPattern = pattern ?? envPattern;

  const [year, month] = date.split(getDateSplitter());

  if (!year || !month) return date;

  switch (finalPattern) {
    case "YYYY/MM":
      return `${year}/${month}`;
    case "YYYY-MM":
      return `${year}-${month}`;
    case "MM-YYYY":
      return `${month}-${year}`;
    default:
      return date;
  }
};
