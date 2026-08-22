(function attachOverlayPresentation(root) {
  const VALID_BACKGROUNDS = new Set(['transparent', 'dim', 'blur']);

  const validBackground = (value, fallback) => (
    VALID_BACKGROUNDS.has(value) ? value : fallback
  );

  /**
   * Decide which visual card an OBS item owns.
   *
   * An image submission includes its social name and attached message, so the
   * whole composition uses the image background. Text background is reserved
   * for text-only submissions. A centered image composition intentionally has
   * no card because its copy is placed directly over the image.
   */
  function resolveOverlayPresentation(content = {}, style = {}) {
    const hasImage = content.hasImage === true;
    const imageBackground = validBackground(style.imageBackgroundStyle, 'transparent');
    const textBackground = validBackground(style.textBackgroundStyle, 'dim');
    const giftBackground = validBackground(style.giftBackgroundStyle, 'dim');
    const isCenteredImage = hasImage && content.textLayout === 'center';

    return {
      contentType: hasImage ? 'image' : 'text',
      contentBackground: isCenteredImage
        ? 'transparent'
        : (hasImage ? imageBackground : textBackground),
      giftBackground,
    };
  }

  function getPlaybackRecoveryDelay(pauseData = {}) {
    if (pauseData.manual === true || pauseData.isCountingDown !== true) return null;
    const remainingSeconds = Number(pauseData.remaining);
    const safeRemaining = Number.isFinite(remainingSeconds) && remainingSeconds >= 0
      ? remainingSeconds
      : 0;
    return Math.round(safeRemaining * 1000) + 350;
  }

  /**
   * Keep a delayed replay response from replacing a newer queue item. A
   * duplicate of the currently visible item is ignored so its timer and media
   * are not restarted, while the same hidden item may be restored.
   */
  function shouldRenderPlayback(current, incoming, isVisible, nowMs = Date.now()) {
    if (!incoming?.id) return false;
    const incomingStartedAt = Date.parse(incoming.playingAt || '');
    const duration = Number(incoming.time ?? incoming.duration ?? incoming.seconds);
    if (Number.isFinite(incomingStartedAt)
      && Number.isFinite(duration)
      && duration > 0
      && incomingStartedAt + (duration * 1000) <= nowMs) {
      return false;
    }
    if (!current?.id) return true;

    const currentStartedAt = Date.parse(current.playingAt || '');
    const sameItem = String(current.id) === String(incoming.id);
    if (sameItem && isVisible) {
      // Manual resume keeps the same item id but moves playingAt forward to
      // preserve the paused duration. Accept that newer timestamp once; the
      // following periodic replay has the same timestamp and is ignored.
      return Number.isFinite(currentStartedAt)
        && Number.isFinite(incomingStartedAt)
        && incomingStartedAt > currentStartedAt;
    }

    if (Number.isFinite(currentStartedAt)
      && Number.isFinite(incomingStartedAt)
      && incomingStartedAt < currentStartedAt) {
      return false;
    }
    return true;
  }

  root.CMESOverlayPresentation = Object.freeze({
    resolveOverlayPresentation,
    getPlaybackRecoveryDelay,
    shouldRenderPlayback,
  });
}(globalThis));
