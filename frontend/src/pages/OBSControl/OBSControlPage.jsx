import React from "react";
import useOBSControl from "../../hooks/useOBSControl";
import OBSControlPanel from "../../components/dashboard/OBSControlPanel";

/**
 * OBSControlPage Entry Point Page.
 * Connects the useOBSControl hook logic layer to the OBSControlPanel presentational component.
 */
export default function OBSControlPage({ API_BASE_URL, adminId, shopId }) {
  const obsControlState = useOBSControl({ API_BASE_URL, adminId, shopId });

  return <OBSControlPanel {...obsControlState} />;
}
