import React, { useContext } from "react";
import useOBSControl from "../../hooks/useOBSControl";
import useOBSTest from "../../hooks/useOBSTest";
import OBSControlPanel from "../../components/dashboard/OBSControlPanel";
import { ShopContext } from "../../contexts/ShopContext";
import { API_BASE_URL as DEFAULT_API_BASE_URL } from "../../config/apiConfig";

/**
 * OBSControlPage Entry Point Page.
 * Connects the useOBSControl hook logic layer to the OBSControlPanel presentational component.
 */
export default function OBSControlPage({ API_BASE_URL, adminId, shopId }) {
  const context = useContext(ShopContext) || {};
  const apiBaseUrl = API_BASE_URL || DEFAULT_API_BASE_URL;
  const activeShopId = shopId || context.shopId;
  const obsControlState = useOBSControl({ API_BASE_URL: apiBaseUrl, adminId, shopId: activeShopId });
  const obsTestState = useOBSTest({ API_BASE_URL: apiBaseUrl, socket: context.socket });

  return <OBSControlPanel {...obsControlState} {...obsTestState} />;
}
