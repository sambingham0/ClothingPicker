export function createSpotifyController(
  elements,
  {
    formatTimestampWithRelative,
    getReasonMessage,
    setText,
    settleMs = 1800
  },
  fetchJson
) {
  let activeSpotifyEmbedUrl = null;
  let inflightSpotifyControl = null;
  let spotifyIsPlaying = null;
  let spotifyCurrentTrackUri = null;
  let spotifyCurrentVolumePercent = null;
  let spotifyControlSettleUntil = 0;
  let spotifyPendingIsPlaying = null;
  let spotifyPendingPreviousTrackUri = null;
  let spotifyPendingVolumePercent = null;

  function setSpotifyEmbed(url) {
    if (!elements.spotifyEmbed) return;

    const nextUrl = typeof url === 'string' && url.trim() ? url.trim() : null;
    if (!nextUrl) {
      elements.spotifyEmbed.hidden = true;
      if (elements.spotifyEmbedWrap) {
        elements.spotifyEmbedWrap.hidden = true;
      }
      if (activeSpotifyEmbedUrl !== null) {
        elements.spotifyEmbed.removeAttribute('src');
        activeSpotifyEmbedUrl = null;
      }
      return;
    }

    if (activeSpotifyEmbedUrl !== nextUrl) {
      elements.spotifyEmbed.src = nextUrl;
      activeSpotifyEmbedUrl = nextUrl;
    }
    elements.spotifyEmbed.hidden = false;
    if (elements.spotifyEmbedWrap) {
      elements.spotifyEmbedWrap.hidden = false;
    }
  }

  function spotifyControlButtons() {
    return [
      elements.spotifyPrevBtn,
      elements.spotifyNextBtn,
      elements.spotifyTransferBtn,
      elements.spotifyToggleBtn,
    ].filter(Boolean);
  }

  function setPendingVolumePercent(value) {
    spotifyPendingVolumePercent = Number.isFinite(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : null;
  }

  function setSpotifyVolumePercent(value) {
    const nextVolume = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
    spotifyCurrentVolumePercent = nextVolume;

    if (elements.spotifyVolumeSlider) {
      elements.spotifyVolumeSlider.value = nextVolume === null ? '0' : String(nextVolume);
    }

    if (elements.spotifyVolumeValue) {
      elements.spotifyVolumeValue.textContent = nextVolume === null ? '—' : `${nextVolume}%`;
    }

    if (elements.spotifyVolumeSlider) {
      elements.spotifyVolumeSlider.disabled = inflightSpotifyControl !== null || nextVolume === null;
      elements.spotifyVolumeSlider.setAttribute('aria-valuenow', nextVolume === null ? '0' : String(nextVolume));
      elements.spotifyVolumeSlider.setAttribute('aria-valuetext', nextVolume === null ? 'unavailable' : `${nextVolume} percent`);
    }
  }

  function updateSpotifyToggleButton() {
    if (!elements.spotifyToggleBtn) return;
    elements.spotifyToggleBtn.textContent = spotifyIsPlaying === true ? 'Pause' : 'Play';
  }

  function updateSpotifyControlButtons() {
    const disabled = inflightSpotifyControl !== null;
    for (const button of spotifyControlButtons()) {
      button.disabled = disabled;
    }

    if (elements.spotifyVolumeSlider) {
      elements.spotifyVolumeSlider.disabled = disabled || spotifyCurrentVolumePercent === null;
    }
  }

  function isSpotifyControlSettling() {
    return Date.now() < spotifyControlSettleUntil;
  }

  function beginSpotifyControlSettle(action) {
    spotifyControlSettleUntil = Date.now() + settleMs;

    if (action === 'play') {
      spotifyPendingIsPlaying = true;
    } else if (action === 'pause') {
      spotifyPendingIsPlaying = false;
    } else {
      spotifyPendingIsPlaying = null;
    }

    if (action === 'next' || action === 'previous') {
      spotifyPendingPreviousTrackUri = spotifyCurrentTrackUri;
    } else {
      spotifyPendingPreviousTrackUri = null;
    }
  }

  function clearSpotifyControlSettle() {
    spotifyControlSettleUntil = 0;
    spotifyPendingIsPlaying = null;
    spotifyPendingPreviousTrackUri = null;
    spotifyPendingVolumePercent = null;
  }

  async function refreshSpotifyWidget() {
    try {
      const payload = await fetchJson('/widgets/spotify');
      renderSpotify(payload);
    } catch (error) {
      console.error('Unable to refresh Spotify widget:', error);
    }
  }

  function renderSpotify(payload, errorMessage = null) {
    if (errorMessage || !payload || typeof payload !== 'object') {
      const message = errorMessage || 'Spotify widget unavailable.';
      setText(elements.spotifySummary, message);
      setText(elements.spotifyUpdated, '—');
      setSpotifyEmbed(null);
      spotifyIsPlaying = null;
      spotifyCurrentTrackUri = null;
      setSpotifyVolumePercent(null);
      spotifyPendingVolumePercent = null;
      updateSpotifyToggleButton();
      updateSpotifyControlButtons();
      return;
    }

    const available = payload.available === true;
    const track = payload.track && typeof payload.track === 'object' ? payload.track : null;
    const device = payload.device && typeof payload.device === 'object' ? payload.device : null;
    const isPlaying = payload.isPlaying === true ? true : payload.isPlaying === false ? false : null;
    const incomingTrackUri = typeof track?.uri === 'string' && track.uri.trim() ? track.uri.trim() : null;
    const incomingVolumePercent = Number.isFinite(device?.volumePercent) ? device.volumePercent : null;

    const settling = isSpotifyControlSettling();
    let effectiveIsPlaying = isPlaying;
    if (settling && spotifyPendingIsPlaying !== null && isPlaying !== spotifyPendingIsPlaying) {
      effectiveIsPlaying = spotifyPendingIsPlaying;
    } else if (spotifyPendingIsPlaying !== null && isPlaying === spotifyPendingIsPlaying) {
      spotifyPendingIsPlaying = null;
    }

    let effectiveTrackUri = incomingTrackUri;
    let effectiveEmbedUrl = typeof payload.embedUrl === 'string' && payload.embedUrl.trim()
      ? payload.embedUrl.trim()
      : null;

    if (settling && spotifyPendingPreviousTrackUri && incomingTrackUri === spotifyPendingPreviousTrackUri) {
      effectiveTrackUri = spotifyCurrentTrackUri;
      effectiveEmbedUrl = activeSpotifyEmbedUrl;
    } else if (spotifyPendingPreviousTrackUri && incomingTrackUri && incomingTrackUri !== spotifyPendingPreviousTrackUri) {
      spotifyPendingPreviousTrackUri = null;
    }

    if (!settling) {
      spotifyPendingPreviousTrackUri = null;
      spotifyPendingIsPlaying = null;
    }

    let statusText = 'Unavailable';
    if (available && effectiveIsPlaying === true) {
      statusText = 'Playing';
    } else if (available && effectiveIsPlaying === false && (track || effectiveTrackUri)) {
      statusText = 'Paused';
    } else if (available) {
      statusText = 'Idle';
    }

    const updatedText = formatTimestampWithRelative(payload.requestedAtUtc);
    const messageText = typeof payload.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : available
        ? 'Spotify is connected.'
        : 'Spotify is unavailable.';

    const deviceName = typeof device?.name === 'string' && device.name.trim() ? device.name.trim() : null;
    const summarySuffix = deviceName ? ` on ${deviceName}` : '';
    const summaryText = available
      ? `${statusText}${summarySuffix}.`
      : `${statusText}${summarySuffix}. ${messageText}`;

    let effectiveVolumePercent = incomingVolumePercent;
    if (settling && spotifyPendingVolumePercent !== null && incomingVolumePercent !== spotifyPendingVolumePercent) {
      effectiveVolumePercent = spotifyPendingVolumePercent;
    } else if (spotifyPendingVolumePercent !== null && incomingVolumePercent === spotifyPendingVolumePercent) {
      spotifyPendingVolumePercent = null;
    }

    if (!settling) {
      spotifyPendingVolumePercent = null;
    }

    setText(elements.spotifySummary, summaryText);
    setText(elements.spotifyUpdated, updatedText);
    setSpotifyEmbed(effectiveEmbedUrl);
    setSpotifyVolumePercent(effectiveVolumePercent);

    spotifyIsPlaying = effectiveIsPlaying;
    if (effectiveTrackUri) {
      spotifyCurrentTrackUri = effectiveTrackUri;
    } else if (!available) {
      spotifyCurrentTrackUri = null;
    }
    updateSpotifyToggleButton();
    updateSpotifyControlButtons();
  }

  async function sendSpotifyControl(action, volumePercent = null) {
    if (inflightSpotifyControl) {
      return;
    }

    beginSpotifyControlSettle(action);

    if (action === 'volume_set') {
      setPendingVolumePercent(volumePercent);
    }

    const previousPlaying = spotifyIsPlaying;
    const previousVolumePercent = spotifyCurrentVolumePercent;

    if (action === 'play') {
      spotifyIsPlaying = true;
      updateSpotifyToggleButton();
    } else if (action === 'pause') {
      spotifyIsPlaying = false;
      updateSpotifyToggleButton();
    }

    inflightSpotifyControl = action;
    updateSpotifyControlButtons();
    const actionLabelMap = {
      previous: 'previous',
      play: 'play',
      pause: 'pause',
      next: 'next',
      volume_set: 'volume',
      transfer_here: 'transfer'
    };
    const actionLabel = actionLabelMap[action] || action;

    try {
      const response = await fetch('/widgets/spotify/control', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        cache: 'no-store',
        body: JSON.stringify(
          volumePercent === null
            ? { action }
            : { action, volumePercent }
        )
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.message || `Spotify command failed (${response.status}).`);
      }

      if (typeof payload.volumePercent === 'number') {
        setPendingVolumePercent(payload.volumePercent);
        setSpotifyVolumePercent(payload.volumePercent);
      }

      window.setTimeout(() => {
        void refreshSpotifyWidget();
      }, 250);
    } catch (error) {
      spotifyIsPlaying = previousPlaying;
      updateSpotifyToggleButton();
      if (volumePercent !== null) {
        setSpotifyVolumePercent(previousVolumePercent);
        setPendingVolumePercent(null);
      }
      clearSpotifyControlSettle();
      console.error(getReasonMessage(error, `Unable to send Spotify ${actionLabel} command.`));
    } finally {
      inflightSpotifyControl = null;
      updateSpotifyControlButtons();
    }
  }

  function bindControls() {
    const spotifyControlBindings = [
      [elements.spotifyPrevBtn, 'previous'],
      [elements.spotifyNextBtn, 'next'],
    ];

    for (const [button, action] of spotifyControlBindings) {
      if (!button) continue;
      button.addEventListener('click', () => {
        void sendSpotifyControl(action);
      });
    }

    if (elements.spotifyToggleBtn) {
      elements.spotifyToggleBtn.addEventListener('click', () => {
        const action = spotifyIsPlaying === true ? 'pause' : 'play';
        void sendSpotifyControl(action);
      });
    }

    if (elements.spotifyTransferBtn) {
      elements.spotifyTransferBtn.addEventListener('click', () => {
        void sendSpotifyControl('transfer_here');
      });
    }

    if (elements.spotifyVolumeSlider) {
      const syncVolumeLabel = () => {
        const sliderValue = Number(elements.spotifyVolumeSlider.value);
        if (elements.spotifyVolumeValue) {
          elements.spotifyVolumeValue.textContent = `${sliderValue}%`;
        }
      };

      elements.spotifyVolumeSlider.addEventListener('input', () => {
        const nextVolume = Number(elements.spotifyVolumeSlider.value);
        setPendingVolumePercent(nextVolume);
        syncVolumeLabel();
      });

      elements.spotifyVolumeSlider.addEventListener('change', () => {
        const nextVolume = Number(elements.spotifyVolumeSlider.value);
        if (Number.isFinite(nextVolume)) {
          setPendingVolumePercent(nextVolume);
          void sendSpotifyControl('volume_set', nextVolume);
        }
      });
    }

    updateSpotifyToggleButton();
    updateSpotifyControlButtons();
  }

  return {
    bindControls,
    renderSpotify
  };
}
