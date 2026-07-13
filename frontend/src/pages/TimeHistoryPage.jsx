import React from "react";
import useTimeHistory from "../hooks/useTimeHistory";
import TimeHistoryPanel from "../components/dashboard/TimeHistoryPanel";

/**
 * TimeHistoryPage Entry Point Page.
 * Connects the useTimeHistory hook logic layer to the TimeHistoryPanel presentational component.
 */
export default function TimeHistoryPage() {
  const { textHistory, imageHistory, birthdayHistory, handleRemove } = useTimeHistory();

  return (
    <TimeHistoryPanel
      textHistory={textHistory}
      imageHistory={imageHistory}
      birthdayHistory={birthdayHistory}
      handleRemove={handleRemove}
    />
  );
}
