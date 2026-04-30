import React, { useEffect, useState } from "react";
import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import AnalyticsService from "src/analytics/AnalyticsService";
import type { InstitutionApiItem } from "src/analytics/AnalyticsService.types";

const uniqueId = "institution-autocomplete-7c2a4e6f-3b5d-4f8a-9c1e-5d7f9b0c2e4f";

export const DATA_TEST_ID = {
  INSTITUTION_AUTOCOMPLETE: `${uniqueId}-autocomplete`,
  INSTITUTION_AUTOCOMPLETE_INPUT: `${uniqueId}-input`,
};

export interface InstitutionAutocompleteProps {
  value: string;
  onChange: (institutionId: string) => void;
  disabled?: boolean;
  required?: boolean;
  options: InstitutionApiItem[];
  loading: boolean;
  error: Error | null;
}

export function useInstitutionOptions() {
  const [options, setOptions] = useState<InstitutionApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAll() {
      setLoading(true);
      const items: InstitutionApiItem[] = [];
      let cursor: string | undefined;

      try {
        do {
          const result = await AnalyticsService.getInstance().listInstitutions(100, cursor);
          items.push(...result.data);
          cursor = result.meta.next_cursor ?? undefined;
        } while (cursor);

        if (isMounted) {
          setOptions(items.sort((a, b) => a.name.localeCompare(b.name)));
          setError(null);
        }
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAll();

    return () => {
      isMounted = false;
    };
  }, []);

  return { options, loading, error };
}

const InstitutionAutocomplete: React.FC<InstitutionAutocompleteProps> = ({
  value,
  onChange,
  disabled,
  required,
  options,
  loading,
  error,
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<InstitutionApiItem | null>(null);

  // Restore selection once options load (e.g. editing an existing user)
  useEffect(() => {
    if (value && options.length > 0) {
      const found = options.find((o) => o.id === value || o.name === value) ?? null;
      setSelectedOption(found);
    }
  }, [options, value]);

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(option) => option.name}
      value={selectedOption}
      onChange={(_event, newValue) => {
        setSelectedOption(newValue);
        // Use id if present, fall back to name (backend stores this as a free-form string)
        onChange(newValue ? newValue.id || newValue.name : "");
      }}
      loading={loading}
      disabled={disabled}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      data-testid={DATA_TEST_ID.INSTITUTION_AUTOCOMPLETE}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("users.institutionAutocomplete.label", "Institution")}
          margin="normal"
          required={required}
          error={!!error}
          helperText={error ? t("users.institutionAutocomplete.loadError", "Failed to load institutions") : undefined}
          data-testid={DATA_TEST_ID.INSTITUTION_AUTOCOMPLETE_INPUT}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={18} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
};

export default InstitutionAutocomplete;
