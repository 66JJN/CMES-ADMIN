import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../public/obs-overlay-presentation.js');
const overlayPath = path.resolve(__dirname, '../public/obs-image-overlay.html');
const source = fs.readFileSync(scriptPath, 'utf8');
const overlayHtml = fs.readFileSync(overlayPath, 'utf8');
const context = { globalThis: {} };
vm.runInNewContext(source, context, { filename: scriptPath });

const { resolveOverlayPresentation, getPlaybackRecoveryDelay, shouldRenderPlayback } = context.globalThis.CMESOverlayPresentation;
const plain = (value) => JSON.parse(JSON.stringify(value));

const style = {
  imageBackgroundStyle: 'blur',
  textBackgroundStyle: 'dim',
  giftBackgroundStyle: 'transparent',
};

test('รูปพร้อมข้อความใช้พื้นหลังของรูปเป็นการ์ดเดียวกัน', () => {
  assert.deepEqual(
    plain(resolveOverlayPresentation({ hasImage: true, textLayout: 'right' }, style)),
    {
      contentType: 'image',
      contentBackground: 'blur',
      giftBackground: 'transparent',
    },
  );
});

test('ข้อความล้วนใช้พื้นหลังข้อความโดยไม่ขึ้นกับค่าของรูป', () => {
  assert.deepEqual(
    plain(resolveOverlayPresentation({ hasImage: false, textLayout: 'right' }, style)),
    {
      contentType: 'text',
      contentBackground: 'dim',
      giftBackground: 'transparent',
    },
  );
});

test('เทมเพลตข้อความกลางภาพบังคับพื้นหลังโปร่งใส', () => {
  assert.deepEqual(
    plain(resolveOverlayPresentation({ hasImage: true, textLayout: 'center' }, style)),
    {
      contentType: 'image',
      contentBackground: 'transparent',
      giftBackground: 'transparent',
    },
  );
});

test('ค่าที่ไม่ถูกต้องย้อนกลับไปใช้ค่าแนะนำอย่างปลอดภัย', () => {
  assert.deepEqual(
    plain(resolveOverlayPresentation(
      { hasImage: true, textLayout: 'right' },
      { imageBackgroundStyle: 'solid', textBackgroundStyle: null, giftBackgroundStyle: 'neon' },
    )),
    {
      contentType: 'image',
      contentBackground: 'transparent',
      giftBackground: 'dim',
    },
  );
});

test('OBS overlay เรียกตัวตัดสินพื้นหลังตอนรู้ชนิดรายการจริง', () => {
  assert.match(overlayHtml, /src="\/obs-overlay-presentation\.js"/);
  assert.match(overlayHtml, /CMESOverlayPresentation\.resolveOverlayPresentation/);
  assert.match(overlayHtml, /content-image/);
  assert.match(overlayHtml, /content-text/);
});

test('ข้อความล้วนไม่ใช้ layout ที่มีไว้สำหรับวางข้อความทับรูป', () => {
  assert.match(overlayHtml, /if \(filePath && normalizedTextLayout !== ['"]right['"]\)/);
});

test('OBS overlay shows reconnecting state after an explicit Web Control disconnect', () => {
  assert.match(overlayHtml, /socket\.on\(['"]obs-operator-connection['"]/);
  assert.match(overlayHtml, /operatorConnected/);
});

test('OBS ขอรายการปัจจุบันซ้ำหลังช่วงพักระหว่างคิวเพื่อกู้ event ที่พลาด', () => {
  assert.equal(typeof getPlaybackRecoveryDelay, 'function');
  if (typeof getPlaybackRecoveryDelay !== 'function') return;
  assert.equal(getPlaybackRecoveryDelay({ isCountingDown: true, remaining: 1 }), 1350);
  assert.equal(getPlaybackRecoveryDelay({ manual: true, remaining: 10 }), null);
  assert.match(overlayHtml, /request-current-playing/);
});

test('OBS periodically reconciles missed playback and rejects delayed older events', () => {
  assert.equal(typeof shouldRenderPlayback, 'function');
  if (typeof shouldRenderPlayback !== 'function') return;
  const current = { id: 'new', playingAt: '2026-08-22T12:00:20.000Z' };
  assert.equal(shouldRenderPlayback(current, {
    id: 'old', playingAt: '2026-08-22T12:00:10.000Z',
  }, false), false);
  assert.equal(shouldRenderPlayback(current, { ...current }, true), false);
  assert.equal(shouldRenderPlayback(current, { ...current }, false), true);
  assert.equal(shouldRenderPlayback(current, {
    id: 'next', playingAt: '2026-08-22T12:00:30.000Z',
  }, false), true);
  assert.match(overlayHtml, /setInterval\(requestCurrentPlaying,\s*\d+\)/);
});

test('OBS accepts the same item once when resume gives it a newer playingAt', () => {
  assert.equal(typeof shouldRenderPlayback, 'function');
  if (typeof shouldRenderPlayback !== 'function') return;
  const beforePause = {
    id: 'image-1', playingAt: '2026-08-22T12:00:00.000Z', time: 15,
  };
  const afterResume = {
    id: 'image-1', playingAt: '2026-08-22T12:00:10.000Z', time: 15,
  };
  const now = Date.parse('2026-08-22T12:00:12.000Z');

  assert.equal(shouldRenderPlayback(beforePause, afterResume, true, now), true);
  assert.equal(shouldRenderPlayback(afterResume, afterResume, true, now), false);
});

test('OBS does not restore an expired item while waiting for MongoDB completion', () => {
  assert.equal(typeof shouldRenderPlayback, 'function');
  if (typeof shouldRenderPlayback !== 'function') return;
  const expired = {
    id: 'image-1', playingAt: '2026-08-22T12:00:00.000Z', time: 15,
  };
  const afterPlayback = Date.parse('2026-08-22T12:00:16.000Z');

  assert.equal(shouldRenderPlayback(expired, expired, false, afterPlayback), false);
});

test('ของขวัญใหม่ต้องออกจากสถานะพักก่อนเริ่มแสดง', () => {
  assert.match(overlayHtml, /function showGift\(payload = \{\}\)[\s\S]*?isPaused = false/);
});

test('OBS overlay ล้างเฉพาะข้อมูลของ test session ที่กำลังแสดง', () => {
  assert.match(overlayHtml, /let activeTestSessionId = null/);
  assert.match(overlayHtml, /socket\.on\(['"]clear-test-display['"]/);
  assert.match(overlayHtml, /data\.testSessionId !== activeTestSessionId/);
  assert.match(overlayHtml, /function clearAllPlaybackTimers\(/);
  assert.match(overlayHtml, /function hideAllContent\(/);
});

test('JavaScript ภายใน OBS overlay ไม่มี syntax error', () => {
  const inlineScripts = [...overlayHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.trim());

  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((script, index) => {
    assert.doesNotThrow(() => new vm.Script(script, { filename: `obs-inline-${index + 1}.js` }));
  });
});
