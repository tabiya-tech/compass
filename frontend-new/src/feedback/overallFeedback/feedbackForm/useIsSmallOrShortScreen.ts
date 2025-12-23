import { useMediaQuery, useTheme } from "@mui/material";

export function useIsSmallOrShortScreen() {
  const theme = useTheme();

  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Material UI breakpoints are based on width. Since we want to control our small screens based on heights and adjust
  // some spacings and paddings, we need to know if the screen is short.
  // We want to do this on feedback form as it doesn't usually looks good on small screens in terms of height.
  // 600px is the height of the small mobile screen(sm)
  const isShortScreen = useMediaQuery("(max-height: 600px)");

  return isSmallMobile || isShortScreen;
}
