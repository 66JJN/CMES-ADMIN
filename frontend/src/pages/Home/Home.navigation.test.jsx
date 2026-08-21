import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShopContext } from '../../contexts/ShopContext';
import Home from './Home';

const mockSpaNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const ReactModule = require('react');
  return {
    Link: ({ to, children, ...props }) => ReactModule.createElement('a', {
      ...props,
      href: to,
      onClick: (event) => {
        event.preventDefault();
        mockSpaNavigate(to);
      },
    }, children),
    useNavigate: () => mockSpaNavigate,
  };
}, { virtual: true });

jest.mock('../../contexts/HomeContext', () => {
  const ReactModule = require('react');
  const HomeContext = ReactModule.createContext(null);
  const value = {
    shopId: 'JJ',
    shopProfile: { name: 'JJ', logo: '' },
    rankingType: 'alltime',
    rankLimit: 10,
    selectedDate: '',
    selectedMonth: '',
    selectedYear: '',
    freeMode: false,
    showAllRanks: false,
    setQrCodeUrl: jest.fn(),
    setShowQrModal: jest.fn(),
    setShowObsModal: jest.fn(),
  };
  return {
    HomeContext,
    HomeProvider: ({ children }) => (
      <HomeContext.Provider value={value}>{children}</HomeContext.Provider>
    ),
  };
});

jest.mock('../../hooks/useDashboardData', () => () => ({
  cardOrder: [],
  cardVisibility: {},
  draggedCard: null,
  dragOverCard: null,
  handleDragStart: jest.fn(),
  handleDragEnd: jest.fn(),
  handleDragOver: jest.fn(),
  handleDrop: jest.fn(),
  toggleCardVisibility: jest.fn(),
  loadShopProfile: jest.fn(),
  loadPerks: jest.fn(),
  loadTopRanks: jest.fn(),
  loadRankingSummary: jest.fn(),
  loadAllRanks: jest.fn(),
  loadBirthdayRequirement: jest.fn(),
}));

jest.mock('../../components/dashboard/FeatureSwitches', () => () => null);
jest.mock('../../components/dashboard/PackageConfig', () => () => null);
jest.mock('../../components/dashboard/VipSupporters', () => () => null);
jest.mock('../../components/dashboard/DashboardModals', () => () => null);

test('เมนูภายใน Admin เปลี่ยนหน้าผ่าน React Router โดยไม่โหลดเว็บใหม่ทั้งหน้า', () => {
  mockSpaNavigate.mockClear();
  render(
    <ShopContext.Provider value={{ shopId: 'JJ', socket: null }}>
      <Home />
    </ShopContext.Provider>,
  );

  fireEvent.click(screen.getByRole('link', { name: 'ตรวจสอบรูปภาพ' }));

  expect(mockSpaNavigate).toHaveBeenCalledWith('/image-queue');
});
