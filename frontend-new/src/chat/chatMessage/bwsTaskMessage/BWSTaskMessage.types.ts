export interface BWSAlternative {
  wa_id: string;
  label: string;
}

export interface BWSTaskMessageProps {
  taskId: string;
  taskNumber: number;
  totalTasks: number;
  alternatives: BWSAlternative[];
  onSubmit: (taskId: string, bestWaId: string, worstWaId: string) => void;
}

// Shape of the metadata field sent from backend on BWS_TASK messages
export interface BWSTaskMetadata {
  task_id: string;
  task_number: number;
  total_tasks: number;
  alternatives: BWSAlternative[];
}
