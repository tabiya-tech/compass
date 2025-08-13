import React from "react";
import { useTheme } from "@mui/material/styles";

export interface RestoreIconProps {
  color?: string;
  width?: number | string;
  height?: number | string;
}

export const RestoreIcon: React.FC<Readonly<RestoreIconProps>> = ({ color, width, height }) => {
  const theme = useTheme();
  const fillColor = color || theme.palette.text.secondary;

  return (
    <svg
      width={width ?? "18"}
      height={height ?? "24"}
      viewBox="0 0 18 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_3404_3489)">
        <path
          d="M13 4V12.0205C12.8349 12.0079 12.6683 12 12.5 12C9.07843 12 6.27588 14.6438 6.02051 18H3C1.9 18 1 17.1 1 16V4H13ZM9.5 0L10.5 1H14V3H0V1H3.5L4.5 0H9.5Z"
          fill={fillColor}
        />
        <path
          d="M12.4286 13C9.35191 13 6.85714 15.4628 6.85714 18.5H5L7.40809 20.8772L7.45143 20.9628L9.95238 18.5H8.09524C8.09524 16.135 10.0329 14.2222 12.4286 14.2222C14.8243 14.2222 16.7619 16.135 16.7619 18.5C16.7619 20.865 14.8243 22.7778 12.4286 22.7778C11.2338 22.7778 10.1505 22.295 9.37048 21.5189L8.49143 22.3867C9.50048 23.3828 10.8871 24 12.4286 24C15.5052 24 18 21.5372 18 18.5C18 15.4628 15.5052 13 12.4286 13ZM11.8095 16.0556V19.1111L14.4591 20.6633L14.9048 19.9239L12.7381 18.6528V16.0556H11.8095Z"
          fill={fillColor}
        />
      </g>
      <defs>
        <clipPath id="clip0_3404_3489">
          <rect width="18" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};

export default RestoreIcon;
