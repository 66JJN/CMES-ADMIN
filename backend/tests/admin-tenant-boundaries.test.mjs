import test from 'node:test';
import assert from 'node:assert/strict';

import TimeHistory from '../models/TimeHistory.js';
import ImageQueue from '../models/ImageQueue.js';
import CheckHistory from '../models/CheckHistory.js';
import { getSettingsHistory, healthCheck } from '../controllers/statusController.js';
import { getOrderStatus, userDeleteOrder } from '../controllers/queueController.js';

const makeResponse = () => {
  const state = { statusCode: 200, body: undefined };
  return {
    state,
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return body;
    },
  };
};

test('settings history is limited to the authenticated shop', async () => {
  const originalFind = TimeHistory.find;
  let receivedQuery;
  TimeHistory.find = (query) => {
    receivedQuery = query;
    return { sort: async () => [] };
  };

  const res = makeResponse();
  try {
    await getSettingsHistory({ shopId: 'Mellow01' }, res);
  } finally {
    TimeHistory.find = originalFind;
  }

  assert.deepEqual(receivedQuery, { shopId: 'Mellow01' });
  assert.deepEqual(res.state.body, []);
});

test('public health response does not reveal the combined queue size', async () => {
  const originalCountDocuments = ImageQueue.countDocuments;
  ImageQueue.countDocuments = async () => 99;

  const res = makeResponse();
  try {
    await healthCheck({}, res);
  } finally {
    ImageQueue.countDocuments = originalCountDocuments;
  }

  assert.equal(Object.hasOwn(res.state.body, 'queueLength'), false);
});

test('an order from another shop is returned as not found', async () => {
  const originalQueueFindOne = ImageQueue.findOne;
  const originalHistoryFindOne = CheckHistory.findOne;
  ImageQueue.findOne = async () => null;
  CheckHistory.findOne = () => ({ sort: async () => null });

  const res = makeResponse();
  try {
    await getOrderStatus({ shopId: 'Mellow01', params: { orderId: 'jj-order' } }, res);
  } finally {
    ImageQueue.findOne = originalQueueFindOne;
    CheckHistory.findOne = originalHistoryFindOne;
  }

  assert.equal(res.state.statusCode, 404);
  assert.equal(res.state.body.status, 'not_found');
});

test('deleting an order from another shop is returned as not found', async () => {
  const originalFindOne = ImageQueue.findOne;
  ImageQueue.findOne = async () => null;

  const res = makeResponse();
  try {
    await userDeleteOrder({
      shopId: 'Mellow01',
      params: { orderId: 'jj-order' },
      app: { get: () => null },
    }, res);
  } finally {
    ImageQueue.findOne = originalFindOne;
  }

  assert.equal(res.state.statusCode, 404);
});

test('deleting a pending order keeps the shop in the final delete query', async () => {
  const originalFindOne = ImageQueue.findOne;
  const originalDeleteOne = ImageQueue.deleteOne;
  const originalFindByIdAndDelete = ImageQueue.findByIdAndDelete;
  let deleteQuery;
  ImageQueue.findOne = async () => ({ _id: 'queue-1', status: 'pending' });
  ImageQueue.deleteOne = async (query) => {
    deleteQuery = query;
    return { deletedCount: 1 };
  };
  ImageQueue.findByIdAndDelete = async () => ({ _id: 'queue-1' });

  const res = makeResponse();
  try {
    await userDeleteOrder({
      shopId: 'Mellow01',
      params: { orderId: 'gift-order-1' },
      app: { get: () => null },
    }, res);
  } finally {
    ImageQueue.findOne = originalFindOne;
    ImageQueue.deleteOne = originalDeleteOne;
    ImageQueue.findByIdAndDelete = originalFindByIdAndDelete;
  }

  assert.deepEqual(deleteQuery, { _id: 'queue-1', shopId: 'Mellow01' });
  assert.equal(res.state.statusCode, 200);
});
