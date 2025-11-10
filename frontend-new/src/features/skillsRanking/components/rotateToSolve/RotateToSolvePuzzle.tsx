import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, keyframes, Theme, Typography, useTheme, useMediaQuery } from "@mui/material";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { DEFAULT_STRINGS } from "src/features/skillsRanking/constants";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const PUZZLE_FEEDBACK_DURATION = 5000;

const uniqueId = "2c8d3b83-3d1c-4c2e-97b9-3d42a1ef9c11";
export const DATA_TEST_ID = {
  CONTAINER: `rotate-to-solve-container-${uniqueId}`,
  INSTRUCTION_TEXT: `rotate-to-solve-instruction-${uniqueId}`,
  CHARACTERS_CONTAINER: `rotate-to-solve-characters-container-${uniqueId}`,
  CHARACTER_BOX: `rotate-to-solve-character-box-${uniqueId}`,
  ROTATE_LEFT_BUTTON: `rotate-to-solve-rotate-left-${uniqueId}`,
  ROTATE_RIGHT_BUTTON: `rotate-to-solve-rotate-right-${uniqueId}`,
  CANCEL_BUTTON: `rotate-to-solve-cancel-${uniqueId}`,
  COMPLETION_MESSAGE: `rotate-to-solve-completion-message-${uniqueId}`,
};

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
  isReplay?: boolean;
  isReplayFinished?: boolean;
  initialPuzzlesSolved?: number;
  initialCorrectRotations?: number;
  initialClicksCount?: number;
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
  isReplay = false,
  isReplayFinished = false,
  initialPuzzlesSolved = 0,
  initialCorrectRotations = 0,
  initialClicksCount = 0,
}) => {
  const [characterStates, setCharacterStates] = useState<CharacterState[]>([]);
  const [currentCharIndex, setCurrentCharIndex] = useState<number | null>(null);
  const [puzzleIndex, setPuzzleIndex] = useState(initialPuzzlesSolved);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const { t } = useTranslation();
  const [isAllComplete, setIsAllComplete] = useState(false);
  const [clicksCount, setClicksCount] = useState(initialClicksCount);
  const [correctRotations, setCorrectRotations] = useState(0);
  const [totalCorrectRotations, setTotalCorrectRotations] = useState(initialCorrectRotations);
  const [startTime, setStartTime] = useState<number | null>(null);
  const theme = useTheme();
  const pulseAnimation = createPulseAnimation(theme.palette.primary.main);

  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const generateChallenge = useCallback((): CharacterState[] => {
    const puzzleString = stringPool[puzzleIndex % stringPool.length];
    return Array.from(puzzleString).map((char) => {
      let angle = 0;
      while (angle % 360 === 0) {
        angle = rotationStep * (Math.floor(Math.random() * (360 / rotationStep)) - 2);
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
    if (disabled || isReplay || isAllComplete || characterStates[index].character === " ") return;
    if (startTime === null) setStartTime(performance.now());
    setCurrentCharIndex(index);
    setClicksCount((count) => count + 1);

    // Report metrics immediately
    if (onReport) {
      const metrics: RotateToSolvePuzzleMetricsReport = {
        puzzles_solved: puzzleIndex,
        correct_rotations: correctRotations,
        clicks_count: clicksCount + 1,
        time_spent_ms: startTime ? Math.round(performance.now() - startTime) : 0,
      };
      onReport(metrics);
    }
  };

  const updateCharacterRotation = (delta: number) => {
    if (disabled || isReplay || isAllComplete || currentCharIndex === null) return;

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

    // Calculate how many characters are now solved in current puzzle
    const solvedCharacters = updatedStates.filter(
      (state) => state.character !== " " && isCharacterSolved(state)
    ).length;

    // Update correct rotations state for current puzzle
    setCorrectRotations(solvedCharacters);

    // Report metrics immediately
    if (onReport) {
      const metrics: RotateToSolvePuzzleMetricsReport = {
        puzzles_solved: puzzleIndex,
        correct_rotations: totalCorrectRotations + solvedCharacters,
        clicks_count: clicksCount + 1,
        time_spent_ms: startTime ? Math.round(performance.now() - startTime) : 0,
      };
      onReport(metrics);
    }

    const allSolved = updatedStates.every(
      (state) => state.character === " " || (state.checked && isCharacterSolved(state))
    );

    if (allSolved) {
      setIsCelebrating(true);
      setCurrentCharIndex(null); // Reset selection
      const now = performance.now();

      const finalReport: RotateToSolvePuzzleMetricsReport = {
        puzzles_solved: puzzleIndex + 1,
        correct_rotations: totalCorrectRotations + solvedCharacters,
        clicks_count: clicksCount + 1,
        time_spent_ms: startTime ? Math.round(now - startTime) : 0,
      };

      onReport?.(finalReport);

      // Show completion message
      const nextPuzzle = puzzleIndex + 1;
      const completedInSession = nextPuzzle - initialPuzzlesSolved;
      if (completedInSession >= puzzles) {
  setCompletionMessage(t("skillsRanking_rotateToSolve_allComplete_message"));
        setIsAllComplete(true);
        setShowCompletionMessage(true);
        // Don't hide the completion message for final puzzle
        setTimeout(() => {
          setIsCelebrating(false);
          setClicksCount(finalReport.clicks_count);
          onSuccess();
        }, PUZZLE_FEEDBACK_DURATION);
      } else {
        setCompletionMessage(t("skillsRanking_rotateToSolve_puzzleComplete_message"));
        setShowCompletionMessage(true);
        setTimeout(() => {
          setIsCelebrating(false);
          setShowCompletionMessage(false);
          setClicksCount(finalReport.clicks_count);
          setTotalCorrectRotations(totalCorrectRotations + solvedCharacters); // Use solvedCharacters from current scope
          setPuzzleIndex(nextPuzzle);
          setCorrectRotations(0); // Reset for next puzzle
        }, PUZZLE_FEEDBACK_DURATION);
      }
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

  // Initialize replay state
  useEffect(() => {
    if (isReplay && isReplayFinished) {
      setIsAllComplete(true);
      setShowCompletionMessage(true);
      setCompletionMessage(t("skillsRanking_rotateToSolve_allComplete_message"));
    }
  }, [isReplay, isReplayFinished, t]);

  // No cleanup needed since we removed the activity timeout

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      data-testid={DATA_TEST_ID.CONTAINER}
    >
  
      <Typography variant="body1" color="text.secondary" data-testid={DATA_TEST_ID.INSTRUCTION_TEXT}>
        {t("skillsRanking_rotateToSolve_instructions_1")}{" "}
        <RotateRightIcon fontSize="inherit" sx={{ verticalAlign: "text-bottom" }} />{t("skillsRanking_rotateToSolve_instructions_2")}{" "}
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
        data-testid={DATA_TEST_ID.CHARACTERS_CONTAINER}
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
              data-testid={DATA_TEST_ID.CHARACTER_BOX}
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
          disabled={disabled || isReplay || isAllComplete}
          sx={{ color: theme.palette.common.black }}
          aria-label={t("skillsRanking_rotateToSolve_rotate_left_aria")}
          data-testid={DATA_TEST_ID.ROTATE_LEFT_BUTTON}
        >
          <RotateLeftIcon />
        </PrimaryIconButton>
        <PrimaryIconButton
          size="small"
          onClick={() => updateCharacterRotation(rotationStep)}
          disabled={disabled || isReplay || isAllComplete}
          sx={{ color: theme.palette.common.black }}
          aria-label={t("skillsRanking_rotateToSolve_rotate_right_aria")}
          data-testid={DATA_TEST_ID.ROTATE_RIGHT_BUTTON}
        >
          <RotateRightIcon />
        </PrimaryIconButton>
      </Box>

      <Box
        display="flex"
        flexDirection="row-reverse"
        alignItems="flex-end"
        width="100%"
        height={theme.fixedSpacing(theme.tabiyaSpacing.xl * 2)} // xl is not quite big enough and we dont want the componenent to move around
        padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        marginTop={
          isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.fixedSpacing(theme.tabiyaSpacing.sm)
        }
        zIndex={20} // bring the notification above the puzzle buttons
      >
        {/* Cancel button on the right (appears first due to row-reverse) */}
        <PrimaryButton
          onClick={onCancel}
          disabled={disabled || isReplay || isAllComplete}
          sx={{ flexShrink: 0 }}
          data-testid={DATA_TEST_ID.CANCEL_BUTTON}
        >
          {t("skillsRanking_common_cancel_button")}
        </PrimaryButton>

        {/* Status message on the left (appears second due to row-reverse) */}
        {showCompletionMessage && (
          <Box
            sx={{
              padding: theme.spacing(1, 2),
              backgroundColor: theme.palette.success.light,
              color: theme.palette.success.contrastText,
              borderRadius: 1,
              textAlign: "center",
              flex: 1,
              animation: "fadeIn 0.3s ease-in",
              "@keyframes fadeIn": {
                "0%": { opacity: 0, transform: "translateY(-10px)" },
                "100%": { opacity: 1, transform: "translateY(0)" },
              },
            }}
            data-testid={DATA_TEST_ID.COMPLETION_MESSAGE}
          >
            <Typography variant="caption" fontWeight="bold">
              {completionMessage}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default RotateToSolveTask;
