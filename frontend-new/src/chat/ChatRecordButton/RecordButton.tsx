import React, { useState, useContext } from "react";
import { IconButton, useTheme } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

interface RecordButtonProps {
  notifyChange: React.Dispatch<React.SetStateAction<string>>;
  isDisabled: boolean;
}

const RecordButton: React.FC<RecordButtonProps> = ({ notifyChange, isDisabled }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recognitionInstance, setRecognitionInstance] = useState<SpeechRecognition | null>(null);

  const isOnline = useContext(IsOnlineContext);

  const handleRecord = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      enqueueSnackbar("Speech recognition is not supported in this browser.", { variant: "info" });
      return;
    }

    if (isRecording && recognitionInstance) {
      recognitionInstance.stop();
      setIsRecording(false);
      setRecognitionInstance(null);
    } else {
      const recognition = new SpeechRecognition();

      recognition.continuous = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setRecognitionInstance(null);
      };

      recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            notifyChange((prev) => prev + event.results[i][0].transcript);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        notifyChange((prev) => prev + interimTranscript);
      };

      recognition.start();
      setRecognitionInstance(recognition);
    }
  };

  // TODO: Brave doesn't record audio, the record starts and after few seconds it is off
  // TODO: Safari doesn't add space between text when recording after taking a break and continue recording

  return (
    <>
      <IconButton onClick={handleRecord} disabled={isDisabled || !isOnline}>
        {isRecording ? (
          <StopIcon sx={{ color: isDisabled || !isOnline ? theme.palette.grey[400] : theme.palette.error.main }} />
        ) : (
          <MicIcon sx={{ color: isDisabled || !isOnline ? theme.palette.grey[400] : theme.palette.primary.dark }} />
        )}
      </IconButton>
    </>
  );
};

export default RecordButton;
