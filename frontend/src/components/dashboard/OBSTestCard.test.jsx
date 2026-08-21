import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OBSTestCard from './OBSTestCard';

test('explains why testing is disabled while customer queue is active', () => {
  render(<OBSTestCard
    obsTest={{ ready: false, code: 'QUEUE_NOT_EMPTY', activeQueueCount: 2, totalSteps: 3 }}
    startObsTest={jest.fn()}
  />);

  expect(screen.getByText('กรุณารอให้คิวว่างก่อน')).toBeInTheDocument();
  expect(screen.getByText('มี 2 รายการที่ต้องแสดงให้เสร็จก่อน')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'เริ่มทดสอบ OBS' })).toBeDisabled();
});

test('shows progress and confirms before stopping', () => {
  const stop = jest.fn();
  render(<OBSTestCard
    obsTest={{
      active: true, status: 'running', sessionId: 's1', currentStep: 'gift', stepNumber: 3, totalSteps: 3,
    }}
    stopObsTest={stop}
  />);

  expect(screen.getByText('กำลังทดสอบ 3/3: ของขวัญ')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'หยุดทดสอบและล้างข้อมูล' }));
  fireEvent.click(screen.getByRole('button', { name: 'ยืนยันหยุดทดสอบ' }));
  expect(stop).toHaveBeenCalledWith('s1');
});

test('cleanup failure keeps submissions blocked and offers a retry', () => {
  const stop = jest.fn();
  render(<OBSTestCard
    obsTest={{
      active: true,
      status: 'failed',
      sessionId: 's1',
      code: 'TEST_CLEANUP_FAILED',
      message: 'ล้างข้อมูลทดสอบยังไม่สำเร็จ ระบบยังปิดรับคิวอยู่',
      totalSteps: 3,
    }}
    stopObsTest={stop}
  />);

  expect(screen.getByText(/ระบบยังปิดรับคิวอยู่/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ลองล้างข้อมูลอีกครั้ง' }));
  expect(stop).toHaveBeenCalledWith('s1');
});
