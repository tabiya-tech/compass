import { enqueueSnackbar, SnackbarKey } from "notistack";
import { buildSupportReference } from "src/error/supportReference/supportReference";
import { ErrorSnackbarContent } from "src/theme/SnackbarProvider/ErrorSnackbarContent";

type Options = {
  where: string;
  error: unknown;
};

export const enqueueErrorSnackbarWithReference = (displayMessage: string, { where, error }: Options): SnackbarKey => {
  const { copyPayload } = buildSupportReference({ error, where, displayMessage });

  return enqueueSnackbar(displayMessage, {
    persist: true,
    content: (key, message) => <ErrorSnackbarContent id={key} message={message} payload={copyPayload} />,
  });
};
