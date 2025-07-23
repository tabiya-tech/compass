import React, { useEffect, useState, useCallback } from "react";
import { Box, Typography, useTheme, Paper, keyframes } from "@mui/material";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

export interface RotateToSolvePuzzleMetricsReport {
  puzzles_solved: number;
  correct_rotations: number;
  clicks_count: number;
  time_spent_ms: number;
}

export interface RotateToSolveTaskProps {
  onSuccess: () => void;
  onReport?: (metrics: RotateToSolvePuzzleMetricsReport) => void;
  tolerance?: number;
  stringPool?: string[];
  rotationStep?: number;
  puzzles?: number;
  disabled?: boolean;
}

const DEFAULT_STRINGS: string[] = [
  "GJRLK",
  "FQZNC",
  "EKJGR",
  "CJFLQ",
  "GRKLE",
  "KZFGC",
  "JRNFQ",
  "QRKLE",
  "ZLCGF",
  "KFQJC"
];

type CharState = {
  char: string;
  angle: number;
  touched: boolean;
  checked: boolean;
};

const pulse = keyframes`
    0% { border-color: transparent; }
    50% { border-color: limegreen; }
    100% { border-color: transparent; }
`;

const RotateToSolveTask: React.FC<RotateToSolveTaskProps> = ({
  onSuccess,
  onReport,
  tolerance = 45,
  stringPool = DEFAULT_STRINGS,
  rotationStep = 45,
  puzzles = 1,
  disabled = false,
}) => {
  const [characters, setCharacters] = useState<CharState[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [isCelebrating, setIsCelebrating] = useState(false);

  const [clicksCount, setClicksCount] = useState(0);
  const [correctRotations, setCorrectRotations] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const theme = useTheme();

  const generateChallenge = useCallback(() => {
    const chosen = stringPool[Math.floor(Math.random() * stringPool.length)];
    return Array.from(chosen).map((char) => {
      if (char === " ") {
        return { char, angle: 0, touched: false, checked: true };
      }
      let angle = 0;
      while (angle % 360 === 0) {
        angle =
          rotationStep *
          Math.floor(Math.random() * (180 / rotationStep) - 90 / rotationStep);
      }
      return {
        char,
        angle,
        touched: false,
        checked: false,
      };
    });
  }, [stringPool, rotationStep]);

  const resetPuzzle = useCallback(() => {
    setCharacters(generateChallenge());
    setCurrentIndex(null);
  }, [generateChallenge]);

  useEffect(() => {
    resetPuzzle();
  }, [resetPuzzle]);

  const isCharSolved = (c: CharState) => {
    if (c.char === " ") return true;
    const normalized = Math.abs(c.angle % 360);
    return normalized < tolerance || Math.abs(normalized - 360) < tolerance;
  };

  const getBorderColor = (char: CharState, selected: boolean): string => {
    if (char.char === " ") return "transparent";
    if (isCharSolved(char)) return theme.palette.primary.main;
    return selected ? theme.palette.error.main : theme.palette.error.light;
  };

  const rotateCurrent = (delta: number) => {
    if (disabled || currentIndex === null || characters[currentIndex].char === " ") return;

    setClicksCount((c) => c + 1);
    setCharacters((prev) => {
      const updated = prev.map((c, i) =>
        i === currentIndex
          ? { ...c, angle: c.angle + delta, touched: true, checked: true }
          : c
      );

      const allCorrect = updated.every(
        (c) =>
          c.char === " " ||
          (c.checked &&
            (Math.abs(c.angle % 360) < tolerance ||
              Math.abs((c.angle % 360) - 360) < tolerance))
      );

      if (allCorrect) {
        setIsCelebrating(true);

        const now = performance.now();
        const report: RotateToSolvePuzzleMetricsReport = {
          puzzles_solved: completedCount + 1,
          correct_rotations: correctRotations + updated.filter((c) => c.char !== " " && isCharSolved(c)).length,
          clicks_count: clicksCount + 1,
          time_spent_ms: startTime ? Math.round(now - startTime) : 0,
        };

        onReport?.(report);

        setTimeout(() => {
          setIsCelebrating(false);
          setCorrectRotations(report.correct_rotations);
          setClicksCount(report.clicks_count);

          setCompletedCount((count) => {
            const next = count + 1;
            if (next >= puzzles) {
              onSuccess();
            } else {
              resetPuzzle();
            }
            return next;
          });
        }, 800); // pulse duration
      }

      return updated;
    });
  };

  return (
    <Paper elevation={1} sx={{ p: 4, borderRadius: 3, maxWidth: 600, mx: "auto" }}>
      <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          Rotate each character until it’s upright
        </Typography>

        <Box
          display="flex"
          gap={1.5}
          padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
          justifyContent="center"
          flexWrap="wrap"
          sx={{
            borderRadius: 2,
            backgroundColor: "background.paper",
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          {characters.map((charState, index) => {
            const selected = index === currentIndex;
            const borderColor = getBorderColor(charState, selected);
            const solved = isCharSolved(charState);

            return (
              <Box
                key={charState.char + index}
                onClick={() => {
                  if (disabled || charState.char === " ") return;
                  if (startTime === null) setStartTime(performance.now());
                  setCurrentIndex(index);
                  setClicksCount((c) => c + 1);
                }}
                sx={{
                  width: 36,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 1,
                  border: `2px solid ${borderColor}`,
                  backgroundColor:
                    selected && !disabled
                      ? theme.palette.primary.main
                      : "transparent",
                  transition: "border-color 0.2s, background-color 0.2s",
                  cursor:
                    disabled || charState.char === " " ? "default" : "pointer",
                  animation:
                    isCelebrating && solved
                      ? `${pulse} 0.8s ease-in-out`
                      : "none",
                }}
              >
                <Typography
                  sx={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: "1rem",
                    transform: `rotate(${charState.angle}deg)`,
                    transition: "transform 150ms ease-out",
                    color: selected
                      ? theme.palette.common.black
                      : theme.palette.text.secondary,
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
            disabled={disabled}
          >
            Counterclockwise
          </PrimaryButton>
          <PrimaryButton
            size="small"
            onClick={() => rotateCurrent(rotationStep)}
            endIcon={<RotateRightIcon />}
            disabled={disabled}
          >
            Clockwise
          </PrimaryButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default RotateToSolveTask;
