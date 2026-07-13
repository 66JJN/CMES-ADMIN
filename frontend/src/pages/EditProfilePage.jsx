import React from "react";
import useEditProfile from "../hooks/useEditProfile";
import EditProfileForm from "../components/dashboard/EditProfileForm";

/**
 * EditProfilePage Entry Point Page.
 * Connects the useEditProfile hook logic layer to the EditProfileForm presentational component.
 */
export default function EditProfilePage() {
  const editProfileState = useEditProfile();

  return <EditProfileForm {...editProfileState} />;
}
