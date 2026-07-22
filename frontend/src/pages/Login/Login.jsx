import React from 'react';
import useRegister from '../../hooks/useRegister';
import RegisterForm from '../../components/dashboard/RegisterForm';

/**
 * Clean entry Login page wrapper composing the Register component.
 * Part of the Clean Architecture folder structure.
 */
export default function Login() {
  const {
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    toggleShowPassword,
    errorMessage,
    isLoading,
    handleLogin,
    handleKeyPress,
  } = useRegister();

  return (
    <RegisterForm
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      showPassword={showPassword}
      toggleShowPassword={toggleShowPassword}
      errorMessage={errorMessage}
      isLoading={isLoading}
      handleLogin={handleLogin}
      handleKeyPress={handleKeyPress}
    />
  );
}
