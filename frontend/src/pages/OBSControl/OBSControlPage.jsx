import React from "react";
import OBSControlPanel from "../../components/dashboard/OBSControlPanel";
import { useOBSControlContext } from "../../contexts/OBSControlContext";

/**
 * OBSControlPage Entry Point Page.
 * Reuses the app-wide OBS session so opening this page never creates a second connection.
 */
export default function OBSControlPage() {
  const obsSessionState = useOBSControlContext() || {};
  return <OBSControlPanel {...obsSessionState} />;
}
