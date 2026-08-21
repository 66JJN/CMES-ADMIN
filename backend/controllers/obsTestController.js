import {
  getObsTestStatus,
  startObsTest,
  stopObsTest,
} from '../services/obsTestService.js';

const sendError = (res, error) => res.status(error.status || 500).json({
  success: false,
  code: error.code || 'OBS_TEST_FAILED',
  message: error.message || 'ไม่สามารถทดสอบ OBS ได้',
});

export const createObsTestController = (overrides = {}) => {
  const service = {
    getStatus: getObsTestStatus,
    start: startObsTest,
    stop: stopObsTest,
    ...overrides,
  };

  return {
    async getStatus(req, res) {
      try {
        return res.json({ success: true, ...(await service.getStatus(req.shopId)) });
      } catch (error) {
        return sendError(res, error);
      }
    },

    async start(req, res) {
      try {
        const result = await service.start({ shopId: req.shopId, io: req.app.get('socketio') });
        return res.json({ success: true, ...result });
      } catch (error) {
        return sendError(res, error);
      }
    },

    async stop(req, res) {
      try {
        const result = await service.stop({
          shopId: req.shopId,
          io: req.app.get('socketio'),
          reason: 'manual',
          expectedSessionId: req.body?.testSessionId || undefined,
        });
        return res.json({ success: true, ...result });
      } catch (error) {
        return sendError(res, error);
      }
    },
  };
};

const controller = createObsTestController();
export const getObsTestStatusController = controller.getStatus;
export const startObsTestController = controller.start;
export const stopObsTestController = controller.stop;
