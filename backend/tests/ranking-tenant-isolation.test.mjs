import test from 'node:test';
import assert from 'node:assert/strict';

import RankingHistory from '../models/RankingHistory.js';
import { getRankingSummary } from '../controllers/rankingController.js';

test('ranking summary uses the JWT shop even when another shop is supplied by the client', async () => {
  const originalAggregate = RankingHistory.aggregate;
  let responseBody;

  RankingHistory.aggregate = async (pipeline) => {
    const requestedShop = pipeline[0]?.$match?.shopId;
    return requestedShop === 'Mellow01'
      ? []
      : [{ totalSum: 25, totalUsers: ['jj-user'] }];
  };

  const req = {
    shopId: 'Mellow01',
    query: { type: 'alltime', shopId: 'JJ' },
    headers: { 'x-shop-id': 'JJ' },
  };
  const res = {
    status() {
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  try {
    await getRankingSummary(req, res);
  } finally {
    RankingHistory.aggregate = originalAggregate;
  }

  assert.deepEqual(responseBody, {
    success: true,
    totalSum: 0,
    totalUsers: 0,
    type: 'alltime',
  });
});
