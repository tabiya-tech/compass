import React, { useEffect, useState, useCallback } from "react";
import { Box, Typography, useTheme, Paper } from "@mui/material";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

export interface RotateToSolveTaskProps {
  onSuccess: () => void;
  tolerance?: number;
  stringPool?: string[];
  rotationStep?: number;
}

const DEFAULT_STRINGS: string[] = ["COMPASS IS AWESOME"];

type CharState = {
  char: string;
  angle: number;
  touched: boolean;
  checked: boolean;
};

const RotateToSolveTask: React.FC<RotateToSolveTaskProps> = ({
                                                               onSuccess,
                                                               tolerance = 45,
                                                               stringPool = DEFAULT_STRINGS,
                                                               rotationStep = 45,
                                                             }) => {
  const [characters, setCharacters] = useState<CharState[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const theme = useTheme();

  const generateChallenge = useCallback(() => {
    const chosen = stringPool[Math.floor(Math.random() * stringPool.length)];
    return Array.from(chosen).map((char) => {
      if (char === " ") {
        return { char, angle: 0, touched: false, checked: true };
      }
      let angle = 0;
      while (angle % 360 === 0) {
        angle = rotationStep * Math.floor(Math.random() * (180 / rotationStep) - (90 / rotationStep));
      }
      return {
        char,
        angle,
        touched: false,
        checked: false,
      };
    });
  }, [stringPool, rotationStep]);

  useEffect(() => {
    setCharacters(generateChallenge());
    setCurrentIndex(null);
  }, [generateChallenge]);

  const rotateCurrent = (delta: number) => {
    if (currentIndex === null || characters[currentIndex].char === " ") return;
    setCharacters((prev) => {
      const updated = prev.map((c, i) =>
        i === currentIndex ? { ...c, angle: c.angle + delta, touched: true, checked: true } : c
      );

      const allCheckedAndCorrect = updated.every(
        (c) =>
          c.char === " " ||
          (c.checked &&
            (Math.abs(c.angle % 360) < tolerance || Math.abs((c.angle % 360) - 360) < tolerance))
      );

      if (allCheckedAndCorrect) {
        onSuccess();
      }

      return updated;
    });
  };

  const isCharSolved = (c: CharState) => {
    if (c.char === " ") return true;
    const normalized = Math.abs(c.angle % 360);
    return normalized < tolerance || Math.abs(normalized - 360) < tolerance;
  };

  const getBorderColor = (char: CharState): string => {
    if (char.char === " ") return "transparent";
    if (!char.checked) return theme.palette.divider;
    if (isCharSolved(char)) return theme.palette.primary.main;
    return theme.palette.error.main;
  };

  return (
    <Paper elevation={3} sx={{ p: 4, borderRadius: 3, maxWidth: 600, mx: "auto" }}>
      <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          Rotate each character until it’s upright
        </Typography>

        <Box
          display="flex"
          gap={1.5}
          justifyContent="center"
          flexWrap="wrap"
          sx={{
            p: 2,
            borderRadius: 2,
            backgroundColor: "background.paper",
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          {characters.map((charState, index) => {
            const selected = index === currentIndex;
            const borderColor = getBorderColor(charState);

            return (
              <Box
                key={charState.char+index}
                onClick={() => charState.char !== " " && setCurrentIndex(index)}
                sx={{
                  width: 36,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 1,
                  border: `2px solid ${borderColor}`,
                  backgroundColor: selected ? theme.palette.action.hover : "transparent",
                  transition: "border-color 0.2s, background-color 0.2s",
                  cursor: charState.char === " " ? "default" : "pointer",
                }}
              >
                <Typography
                  sx={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: "1rem",
                    transform: `rotate(${charState.angle}deg)`,
                    transition: "transform 150ms ease-out",
                    color: selected ? theme.palette.primary.dark : theme.palette.text.secondary,
                  }}
                >
                  {charState.char}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box display="flex" gap={2}>
          <PrimaryButton
            size="small"
            onClick={() => rotateCurrent(-rotationStep)}
            startIcon={<RotateLeftIcon />}
          >
            Counterclockwise
          </PrimaryButton>
          <PrimaryButton
            size="small"
            onClick={() => rotateCurrent(rotationStep)}
            endIcon={<RotateRightIcon />}
          >
            Clockwise
          </PrimaryButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default RotateToSolveTask;
