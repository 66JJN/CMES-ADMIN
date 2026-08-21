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

const { resolveOverlayPresentation, getPlaybackRecoveryDelay } = context.globalThis.CMESOverlayPresentation;
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

test('OBS overlay shows fallback when the operator explicitly disconnects control', () => {
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
