import React, { useEffect, useState } from "react";
import { Box, Typography, keyframes } from "@mui/material";

const dotAnimation = keyframes`
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(-2px); opacity: 1; }
`;

const TypingIndicator = () => {
  const [displayText, setDisplayText] = useState("Typing");

  useEffect(() => {
    // Change text after 15 seconds
    const textChangeTimer = setTimeout(() => {
      setDisplayText("Please wait, I'm thinking");
    }, 15000);

    return () => {
      clearTimeout(textChangeTimer);
    };
  }, []);

  return (
    <Box display="flex" alignItems="baseline">
      <Typography>{displayText}</Typography>
      <Box component="span">
        {[0, 1, 2].map((i) => (
          <Typography
            key={i}
            component="span"
            sx={{
              display: "inline-block",
              fontSize: "1.5rem",
              lineHeight: 0,
              animation: `${dotAnimation} 0.8s infinite ease-in-out`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            .
          </Typography>
        ))}
      </Box>
    </Box>
  );
};

export default TypingIndicator;
