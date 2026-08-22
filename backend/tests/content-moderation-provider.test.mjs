import test from 'node:test';
import assert from 'node:assert/strict';

import ShopSetting from '../models/ShopSetting.js';
import TimeHistory from '../models/TimeHistory.js';
import { getSystemStatus, updateSystemConfig } from '../controllers/statusController.js';
import { moderateImage } from '../utils/contentModeration.js';

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

const makeApp = () => ({
  get(name) {
    if (name === 'systemConfig') return {};
    return null;
  },
});

const withEnv = async (values, run) => {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('a shop without a saved provider receives Sightengine as the default without exposing secrets', async () => {
  const originalFindOneAndUpdate = ShopSetting.findOneAndUpdate;
  const originalHistoryFind = TimeHistory.find;
  ShopSetting.findOneAndUpdate = async () => ({
    shopId: 'Mellow01',
    systemConfig: {},
    displayTime: 8,
    autoPlayEnabled: true,
    birthdaySpendingRequirement: 100,
    freeMode: false,
    publicRankingType: 'alltime',
  });
  TimeHistory.find = () => ({ sort: () => ({ lean: async () => [] }) });

  const res = makeResponse();
  try {
    await withEnv({
      SIGHTENGINE_API_USER: 'sight-user',
      SIGHTENGINE_API_SECRET: 'sight-secret',
      OBJEXIFY_API_BASE_URL: 'https://objexify.example',
      OBJEXIFY_API_KEY: 'objexify-secret',
    }, () => getSystemStatus({ shopId: 'Mellow01', app: makeApp() }, res));
  } finally {
    ShopSetting.findOneAndUpdate = originalFindOneAndUpdate;
    TimeHistory.find = originalHistoryFind;
  }

  assert.equal(res.state.body.moderationProvider, 'sightengine');
  assert.deepEqual(res.state.body.moderationProviders, {
    sightengine: { configured: true },
    objexify: { configured: true },
  });
  assert.equal(JSON.stringify(res.state.body).includes('sight-secret'), false);
  assert.equal(JSON.stringify(res.state.body).includes('objexify-secret'), false);
});

test('an unsupported moderation provider is rejected before shop settings are written', async () => {
  const originalFindOne = ShopSetting.findOne;
  const originalFindOneAndUpdate = ShopSetting.findOneAndUpdate;
  let writeCalled = false;
  ShopSetting.findOne = () => ({ lean: async () => ({ shopId: 'JJ', systemConfig: {} }) });
  ShopSetting.findOneAndUpdate = async () => {
    writeCalled = true;
    return {};
  };

  const res = makeResponse();
  try {
    await updateSystemConfig({
      shopId: 'JJ',
      body: { moderationProvider: 'unknown-api' },
      app: makeApp(),
    }, res);
  } finally {
    ShopSetting.findOne = originalFindOne;
    ShopSetting.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.equal(res.state.statusCode, 400);
  assert.equal(res.state.body.success, false);
  assert.equal(writeCalled, false);
});

test('existing Sightengine moderation remains the default provider', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      status: 'success',
      nudity: { sexual_activity: 0.01, sexual_display: 0, erotica: 0 },
      weapon: { classes: { firearm: 0.02, knife: 0.01 } },
      alcohol: { prob: 0.03 },
      recreational_drug: { prob: 0.01 },
      offensive: { prob: 0.02 },
      gore: { prob: 0.01 },
    }),
  });

  const result = await withEnv({
    SIGHTENGINE_API_USER: 'sight-user',
    SIGHTENGINE_API_SECRET: 'sight-secret',
  }, () => moderateImage('https://res.cloudinary.com/demo/image/upload/image.jpg', { fetchImpl }));

  assert.equal(result.provider, 'sightengine');
  assert.equal(result.aiChecked, true);
  assert.equal(result.safe, true);
});

test('Sightengine uses the highest nudity and weapon sub-score when deciding safety', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      status: 'success',
      nudity: { sexual_activity: 0.01, sexual_display: 0.02, erotica: 0.9 },
      weapon: { classes: { firearm: 0.1, knife: 0.95 } },
      alcohol: { prob: 0 },
      recreational_drug: { prob: 0 },
      offensive: { prob: 0 },
      gore: { prob: 0 },
    }),
  });

  const result = await withEnv({
    SIGHTENGINE_API_USER: 'sight-user',
    SIGHTENGINE_API_SECRET: 'sight-secret',
  }, () => moderateImage('https://res.cloudinary.com/demo/image/upload/image.jpg', { fetchImpl }));

  assert.equal(result.safe, false);
  assert.equal(result.scores.nudity, 0.9);
  assert.equal(result.scores.weapon, 0.95);
});

test('Objexify passed response is normalized as a safe checked image', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url) === 'https://res.cloudinary.com/demo/image/upload/image.jpg') {
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : null },
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'passed',
        results: [{
          original_filename: 'image.jpg',
          detections: [],
          model_summary: {},
          processed_image_url: null,
          processed_blurred_image_url: null,
        }],
        skipped: [],
        processed_count: 1,
        output_modes: [],
        summary: {},
        summary_labels: [],
      }),
    };
  };

  const result = await withEnv({
    SIGHTENGINE_API_USER: undefined,
    SIGHTENGINE_API_SECRET: undefined,
    OBJEXIFY_API_BASE_URL: 'https://objexify.example/',
    OBJEXIFY_API_KEY: 'friend-key',
  }, () => moderateImage('https://res.cloudinary.com/demo/image/upload/image.jpg', { provider: 'objexify', fetchImpl }));

  assert.equal(result.provider, 'objexify');
  assert.equal(result.aiChecked, true);
  assert.equal(result.safe, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, 'https://objexify.example/analyze-image');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer friend-key');
});

test('Objexify inappropriate response preserves labels and requires Admin review', async () => {
  const fetchImpl = async (url) => {
    if (String(url) === 'https://res.cloudinary.com/demo/image/upload/image.png') {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer,
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'inappropriate',
        results: [{
          original_filename: 'image.png',
          detections: [{
            label: 'weapon', confidence: 0.91, bbox: [1, 2, 3, 4], model_type: 'violence_detector',
          }],
          model_summary: { weapon: 1 },
          processed_image_url: 'https://objexify.example/processed/image_bbox.png',
          processed_blurred_image_url: 'https://objexify.example/processed/image_blur.png',
        }],
        skipped: [],
        processed_count: 1,
        output_modes: ['bbox', 'blur'],
        summary: { weapon: 1 },
        summary_labels: ['weapon'],
      }),
    };
  };

  const result = await withEnv({
    SIGHTENGINE_API_USER: undefined,
    SIGHTENGINE_API_SECRET: undefined,
    OBJEXIFY_API_BASE_URL: 'https://objexify.example',
    OBJEXIFY_API_KEY: 'friend-key',
  }, () => moderateImage('https://res.cloudinary.com/demo/image/upload/image.png', { provider: 'objexify', fetchImpl }));

  assert.equal(result.provider, 'objexify');
  assert.equal(result.aiChecked, true);
  assert.equal(result.safe, false);
  assert.deepEqual(result.reasons, ['พบเนื้อหาไม่เหมาะสม: weapon (91.0%)']);
  assert.equal(result.scores.weapon, 0.91);
});

test('Objexify errors keep the image pending instead of pretending it was checked', async () => {
  const fetchImpl = async (url) => {
    if (String(url) === 'https://res.cloudinary.com/demo/image/upload/image.jpg') {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => Uint8Array.from([1]).buffer,
      };
    }
    return { ok: false, status: 503, json: async () => ({ error: 'offline' }) };
  };

  const result = await withEnv({
    SIGHTENGINE_API_USER: undefined,
    SIGHTENGINE_API_SECRET: undefined,
    OBJEXIFY_API_BASE_URL: 'https://objexify.example',
    OBJEXIFY_API_KEY: 'friend-key',
  }, () => moderateImage('https://res.cloudinary.com/demo/image/upload/image.jpg', { provider: 'objexify', fetchImpl }));

  assert.equal(result.provider, 'objexify');
  assert.equal(result.aiChecked, false);
  assert.equal(result.safe, false);
  assert.match(result.reasons[0], /503/);
});

test('Objexify unsupported WebP image stays pending with a clear reason', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'image/webp' },
    arrayBuffer: async () => Uint8Array.from([1]).buffer,
  });

  const result = await withEnv({
    SIGHTENGINE_API_USER: undefined,
    SIGHTENGINE_API_SECRET: undefined,
    OBJEXIFY_API_BASE_URL: 'https://objexify.example',
    OBJEXIFY_API_KEY: 'friend-key',
  }, () => moderateImage('https://res.cloudinary.com/demo/image/upload/image.webp', { provider: 'objexify', fetchImpl }));

  assert.equal(result.aiChecked, false);
  assert.equal(result.safe, false);
  assert.match(result.reasons[0], /JPG|PNG/);
});

test('Objexify refuses to download images from private or untrusted hosts', async () => {
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    throw new Error('must not fetch an untrusted URL');
  };

  const result = await withEnv({
    SIGHTENGINE_API_USER: undefined,
    SIGHTENGINE_API_SECRET: undefined,
    OBJEXIFY_API_BASE_URL: 'https://objexify.example',
    OBJEXIFY_API_KEY: 'friend-key',
  }, () => moderateImage('http://127.0.0.1/private.jpg', { provider: 'objexify', fetchImpl }));

  assert.equal(fetchCalled, false);
  assert.equal(result.aiChecked, false);
  assert.match(result.reasons[0], /Cloudinary/);
});
