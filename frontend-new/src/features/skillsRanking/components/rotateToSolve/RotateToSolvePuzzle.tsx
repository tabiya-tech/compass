import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, keyframes, Typography, useTheme } from "@mui/material";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { DEFAULT_STRINGS } from "src/features/skillsRanking/constants";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const PUZZLE_FEEDBACK_DURATION = 3000;

export interface RotateToSolvePuzzleMetricsReport {
  puzzles_solved: number;
  correct_rotations: number;
  clicks_count: number;
  time_spent_ms: number;
}

export interface RotateToSolveTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
  onReport?: (metrics: RotateToSolvePuzzleMetricsReport) => void;
  tolerance?: number;
  stringPool?: string[];
  rotationStep?: number;
  puzzles?: number;
  disabled?: boolean;
}

interface CharacterState {
  character: string;
  angle: number;
  touched: boolean;
  checked: boolean;
}

const createPulseAnimation = (primaryColor: string) => keyframes`
  0% { transform: scale(1); border-color: transparent; }
  50% { transform: scale(1.1); border-color: ${primaryColor}; }
  100% { transform: scale(1); border-color: transparent; }
`;

const RotateToSolveTask: React.FC<RotateToSolveTaskProps> = ({
  onSuccess,
  onCancel,
  onReport,
  tolerance = 45,
  stringPool = DEFAULT_STRINGS,
  rotationStep = 45,
  puzzles = 1,
  disabled = false,
}) => {
  const [characterStates, setCharacterStates] = useState<CharacterState[]>([]);
  const [currentCharIndex, setCurrentCharIndex] = useState<number | null>(null);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [isAllComplete, setIsAllComplete] = useState(false);
  const [clicksCount, setClicksCount] = useState(0);
  const [correctRotations, setCorrectRotations] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [activityTimeoutId, setActivityTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const theme = useTheme();
  const pulseAnimation = createPulseAnimation(theme.palette.primary.main);

  const generateChallenge = useCallback((): CharacterState[] => {
    const puzzleString = stringPool[puzzleIndex % stringPool.length];
    return Array.from(puzzleString).map((char) => {
      let angle = 0;
      while (angle % 360 === 0) {
        angle = rotationStep * (Math.floor(Math.random() * (180 / rotationStep)) - 2);
      }
      return {
        character: char,
        angle,
        touched: false,
        checked: false,
      };
    });
  }, [stringPool, puzzleIndex, rotationStep]);

  const isCharacterSolved = (charState: CharacterState) => {
    const normalized = Math.abs(charState.angle % 360);
    return normalized < tolerance || Math.abs(normalized - 360) < tolerance;
  };

  const selectCharacter = (index: number) => {
    if (disabled || isAllComplete || characterStates[index].character === " ") return;
    if (startTime === null) setStartTime(performance.now());
    setCurrentCharIndex(index);
    setClicksCount((count) => count + 1);

    // Track activity
    // Clear existing activity timeout
    if (activityTimeoutId) {
      clearTimeout(activityTimeoutId);
    }

    // Set new activity timeout (user is inactive after 2 seconds)
    const newTimeoutId = setTimeout(() => {
      if (onReport) {
        const metrics: RotateToSolvePuzzleMetricsReport = {
          puzzles_solved: puzzleIndex,
          correct_rotations: correctRotations,
          clicks_count: clicksCount + 1,
          time_spent_ms: startTime ? Math.round(performance.now() - startTime) : 0,
        };
        onReport(metrics);
      }
    }, 2000);
    setActivityTimeoutId(newTimeoutId);
  };

  const updateCharacterRotation = (delta: number) => {
    if (disabled || isAllComplete || currentCharIndex === null) return;

    setClicksCount((count) => count + 1);

    const updatedStates = characterStates.map((state, index) => {
      if (index !== currentCharIndex || state.character === " ") return state;
      return {
        ...state,
        angle: state.angle + delta,
        touched: true,
        checked: true,
      };
    });

    setCharacterStates(updatedStates);

    // Track activity
    // Clear existing activity timeout
    if (activityTimeoutId) {
      clearTimeout(activityTimeoutId);
    }

    // Set new activity timeout (user is inactive after 2 seconds)
    const newTimeoutId = setTimeout(() => {
      if (onReport) {
        const metrics: RotateToSolvePuzzleMetricsReport = {
          puzzles_solved: puzzleIndex,
          correct_rotations:
            correctRotations +
            updatedStates.filter((state) => state.character !== " " && isCharacterSolved(state)).length,
          clicks_count: clicksCount + 1,
          time_spent_ms: startTime ? Math.round(performance.now() - startTime) : 0,
        };
        onReport(metrics);
      }
    }, 2000);
    setActivityTimeoutId(newTimeoutId);

    const allSolved = updatedStates.every(
      (state) => state.character === " " || (state.checked && isCharacterSolved(state))
    );

    if (allSolved) {
      setIsCelebrating(true);
      setCurrentCharIndex(null); // Reset selection
      const now = performance.now();

      const finalReport: RotateToSolvePuzzleMetricsReport = {
        puzzles_solved: puzzleIndex + 1,
        correct_rotations:
          correctRotations +
          updatedStates.filter((state) => state.character !== " " && isCharacterSolved(state)).length,
        clicks_count: clicksCount + 1,
        time_spent_ms: startTime ? Math.round(now - startTime) : 0,
      };

      onReport?.(finalReport);

      // Show completion message
      const nextPuzzle = puzzleIndex + 1;
      if (nextPuzzle >= puzzles) {
        setCompletionMessage("All puzzles complete! Well done!");
        setIsAllComplete(true);
      } else {
        setCompletionMessage("Puzzle complete! Please solve one more...");
      }
      setShowCompletionMessage(true);

      setTimeout(() => {
        setIsCelebrating(false);
        setShowCompletionMessage(false);
        setCorrectRotations(finalReport.correct_rotations);
        setClicksCount(finalReport.clicks_count);
        if (nextPuzzle >= puzzles) {
          onSuccess();
        } else {
          setPuzzleIndex(nextPuzzle);
        }
      }, PUZZLE_FEEDBACK_DURATION);
    }
  };

  const getBorderColor = useMemo(
    () =>
      (solved: boolean, isSelected: boolean): string => {
        if (isSelected) {
          if (solved) return theme.palette.success.main;
          return theme.palette.error.main;
        }
        if (solved) return theme.palette.success.light;
        return theme.palette.error.light;
      },
    [theme]
  );

  useEffect(() => {
    setCharacterStates(generateChallenge());
  }, [generateChallenge]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutId) {
        clearTimeout(activityTimeoutId);
      }
    };
  }, [activityTimeoutId]);

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
      <Typography variant="body1" color="text.secondary">
        Rotate each letter until it’s upright. Select a letter by clicking on it, then rotate it clockwise with{" "}
        <RotateRightIcon fontSize="inherit" sx={{ verticalAlign: "text-bottom" }} /> or counterclockwise with{" "}
        <RotateLeftIcon fontSize="inherit" sx={{ verticalAlign: "text-bottom" }} />.
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
        {characterStates.map((charState, index) => {
          const isSelected = index === currentCharIndex;
          const solved = isCharacterSolved(charState);
          const borderColor = getBorderColor(solved, isSelected);

          return (
            <Box
              key={charState.character + index}
              onClick={() => selectCharacter(index)}
              sx={{
                width: 36,
                height: 48,
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 1,
                border: `2px solid ${borderColor}`,
                backgroundColor: isSelected && !disabled ? theme.palette.primary.main : "transparent",
                transition: "border-color 0.2s, background-color 0.2s",
                cursor: disabled ? "default" : "pointer",
                animation: isCelebrating && solved ? `${pulseAnimation} 0.4s ease-in-out` : "none",
              }}
            >
              <Typography
                sx={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: "1rem",
                  transform: `rotate(${charState.angle}deg)`,
                  transition: "transform 150ms ease-out",
                  color: isSelected ? theme.palette.common.black : theme.palette.text.secondary,
                }}
              >
                {charState.character}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Box display="flex" gap={2}>
        <PrimaryIconButton
          size="small"
          onClick={() => updateCharacterRotation(-rotationStep)}
          disabled={disabled || isAllComplete}
          sx={{ color: theme.palette.common.black }}
          aria-label="Rotate character counterclockwise"
        >
          <RotateLeftIcon />
        </PrimaryIconButton>
        <PrimaryIconButton
          size="small"
          onClick={() => updateCharacterRotation(rotationStep)}
          disabled={disabled || isAllComplete}
          sx={{ color: theme.palette.common.black }}
          aria-label="Rotate character clockwise"
        >
          <RotateRightIcon />
        </PrimaryIconButton>
      </Box>

      {/* Completion message */}
      {showCompletionMessage && (
        <Box
          sx={{
            padding: theme.spacing(2),
            backgroundColor: theme.palette.success.light,
            color: theme.palette.success.contrastText,
            borderRadius: 1,
            textAlign: "center",
            animation: "fadeIn 0.3s ease-in",
            "@keyframes fadeIn": {
              "0%": { opacity: 0, transform: "translateY(-10px)" },
              "100%": { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <Typography variant="body1" fontWeight="bold">
            {completionMessage}
          </Typography>
        </Box>
      )}

      <Box display="flex" justifyContent="flex-end" width="100%" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
        <PrimaryButton onClick={onCancel} disabled={disabled || isAllComplete} sx={{ marginTop: theme.spacing(2) }}>
          Cancel
        </PrimaryButton>
      </Box>
    </Box>
  );
};

export default RotateToSolveTask;
