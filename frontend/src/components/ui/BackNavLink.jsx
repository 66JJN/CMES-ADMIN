import React from "react";
import { Link } from "react-router-dom";

/**
 * Shared navigation back link for admin pages.
 * Keeps its visual treatment and accessible name consistent across the app.
 */
export default function BackNavLink({ to = "/home", className = "", label = "กลับหน้าหลัก" }) {
  return (
    <Link to={to} className={["back-nav-btn", className].filter(Boolean).join(" ")} aria-label={label} title={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 19l-7-7 7-7" />
      </svg>
    </Link>
  );
}
