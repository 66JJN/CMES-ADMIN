import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { HomeContext } from '../../contexts/HomeContext';
import FeatureSwitches from './FeatureSwitches';
import useSocket from '../../hooks/useSocket';
import useDashboardData from '../../hooks/useDashboardData';

jest.mock('../../hooks/useSocket');
jest.mock('../../hooks/useDashboardData');

const renderFeatureSwitches = (overrides = {}) => {
  const context = {
    systemOn: true,
    enableImage: true,
    enableText: true,
    enableGift: true,
    enableBirthday: true,
    freeMode: false,
    queueAccepting: true,
    birthdaySpendingRequirement: 100,
    setBirthdaySpendingRequirement: jest.fn(),
    moderationProvider: 'sightengine',
    moderationProviders: {
      sightengine: { configured: true },
      objexify: { configured: true },
    },
    ...overrides,
  };

  return render(
    <HomeContext.Provider value={context}>
      <FeatureSwitches isCollapsed={false} onToggleVisibility={jest.fn()} />
    </HomeContext.Provider>
  );
};

beforeEach(() => {
  useDashboardData.mockReturnValue({ handleSaveBirthdayRequirement: jest.fn() });
});

test('Admin can manually select Objexify as the moderation provider', () => {
  const handleModerationProviderChange = jest.fn();
  useSocket.mockReturnValue({
    handleToggleSystem: jest.fn(),
    handleToggleImage: jest.fn(),
    handleToggleText: jest.fn(),
    handleToggleGift: jest.fn(),
    handleToggleBirthday: jest.fn(),
    handleToggleFreeMode: jest.fn(),
    handleToggleQueueAccepting: jest.fn(),
    handleModerationProviderChange,
  });

  renderFeatureSwitches();
  fireEvent.change(screen.getByLabelText('API ตรวจสอบรูปภาพ'), { target: { value: 'objexify' } });

  expect(handleModerationProviderChange).toHaveBeenCalledWith('objexify');
  expect(screen.getByText('Sightengine (หลัก)')).not.toBeNull();
  expect(screen.getByText('Objexify (ทดลอง)')).not.toBeNull();
});

test('Objexify cannot be selected when its server credentials are missing', () => {
  useSocket.mockReturnValue({
    handleToggleSystem: jest.fn(),
    handleToggleImage: jest.fn(),
    handleToggleText: jest.fn(),
    handleToggleGift: jest.fn(),
    handleToggleBirthday: jest.fn(),
    handleToggleFreeMode: jest.fn(),
    handleToggleQueueAccepting: jest.fn(),
    handleModerationProviderChange: jest.fn(),
  });

  renderFeatureSwitches({
    moderationProviders: {
      sightengine: { configured: true },
      objexify: { configured: false },
    },
  });

  expect(screen.getByRole('option', { name: 'Objexify (ยังไม่ได้ตั้งค่า)' }).disabled).toBe(true);
});
