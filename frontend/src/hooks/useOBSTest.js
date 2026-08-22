import { useCallback, useEffect, useRef, useState } from 'react';
import adminFetch from '../config/authFetch';

const EMPTY_STATUS = {
  active: false,
  ready: false,
  displayConnected: false,
  activeQueueCount: 0,
  sessionId: null,
  currentStep: null,
  stepNumber: 0,
  totalSteps: 3,
  status: 'idle',
  code: null,
  message: 'กำลังตรวจสอบความพร้อม',
};

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || 'ไม่สามารถทดสอบ OBS ได้'), {
      code: data.code || 'OBS_TEST_FAILED',
      status: response.status,
    });
  }
  return data;
};

export default function useOBSTest({ API_BASE_URL, socket }) {
  const [obsTest, setObsTest] = useState(EMPTY_STATUS);
  const [isObsTestBusy, setIsObsTestBusy] = useState(false);
  // A Socket.IO update can arrive while an older HTTP status request is still
  // in flight. Only the newest source is allowed to update the progress UI.
  const statusRevisionRef = useRef(0);

  const mergeStatus = useCallback((status = {}) => {
    statusRevisionRef.current += 1;
    setObsTest((previous) => ({ ...previous, ...status }));
  }, []);

  const refreshObsTest = useCallback(async () => {
    const revision = statusRevisionRef.current + 1;
    statusRevisionRef.current = revision;
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/obs-test/status`);
      const status = await parseResponse(response);
      if (statusRevisionRef.current === revision) {
        setObsTest((previous) => ({ ...previous, ...status }));
      }
    } catch (error) {
      if (statusRevisionRef.current === revision) {
        setObsTest((previous) => ({
          ...previous,
          ready: false,
          code: error.code || 'OBS_TEST_FAILED',
          message: error.message || 'ไม่สามารถตรวจสอบความพร้อมของ OBS ได้',
        }));
      }
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    refreshObsTest();
  }, [refreshObsTest]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleStatus = (status) => mergeStatus(status);
    const handleFinished = (status) => mergeStatus({ ...status, active: false });
    const handleQueueChanged = () => refreshObsTest();
    socket.on('obs-test-status', handleStatus);
    socket.on('obs-test-finished', handleFinished);
    socket.on('admin-update-queue', handleQueueChanged);
    socket.on('queue-control-updated', handleQueueChanged);
    return () => {
      socket.off('obs-test-status', handleStatus);
      socket.off('obs-test-finished', handleFinished);
      socket.off('admin-update-queue', handleQueueChanged);
      socket.off('queue-control-updated', handleQueueChanged);
    };
  }, [socket, mergeStatus, refreshObsTest]);

  const runAction = useCallback(async (path, body) => {
    const revision = statusRevisionRef.current + 1;
    statusRevisionRef.current = revision;
    setIsObsTestBusy(true);
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/obs-test/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const status = await parseResponse(response);
      if (statusRevisionRef.current === revision) {
        setObsTest((previous) => ({ ...previous, ...status }));
      }
      return status;
    } catch (error) {
      if (statusRevisionRef.current === revision) {
        setObsTest((previous) => ({
          ...previous,
          code: error.code || 'OBS_TEST_FAILED',
          message: error.message || 'ไม่สามารถทดสอบ OBS ได้',
        }));
      }
      return null;
    } finally {
      setIsObsTestBusy(false);
    }
  }, [API_BASE_URL]);

  const startObsTest = useCallback(() => runAction('start'), [runAction]);
  const stopObsTest = useCallback(
    (testSessionId) => runAction('stop', { testSessionId }),
    [runAction],
  );

  return { obsTest, isObsTestBusy, startObsTest, stopObsTest, refreshObsTest };
}
