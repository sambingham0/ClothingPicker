const CONTROL_REPEAT_START_MS = 260;
const CONTROL_REPEAT_INTERVAL_MS = 120;
const CONTROL_FEEDBACK_MS = 140;

function pulseControl(button) {
    if (!button) return;
    button.classList.remove('is-pressed');
    button.classList.add('is-pressed');

    window.setTimeout(() => {
        button.classList.remove('is-pressed');
    }, CONTROL_FEEDBACK_MS);
}

export function bindRotateControl(button, onRotate) {
    if (!button || typeof onRotate !== 'function') return;

    let repeatStartTimer = null;
    let repeatTimer = null;
    let pointerActive = false;

    const clearRepeatTimers = () => {
        if (repeatStartTimer !== null) {
            window.clearTimeout(repeatStartTimer);
            repeatStartTimer = null;
        }
        if (repeatTimer !== null) {
            window.clearInterval(repeatTimer);
            repeatTimer = null;
        }
    };

    const rotateOnce = () => {
        const changed = onRotate();
        if (changed) {
            pulseControl(button);
        }
    };

    const stopPointerScroll = () => {
        pointerActive = false;
        clearRepeatTimers();
    };

    button.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;

        event.preventDefault();
        pointerActive = true;
        rotateOnce();

        repeatStartTimer = window.setTimeout(() => {
            if (!pointerActive) return;

            repeatTimer = window.setInterval(() => {
                rotateOnce();
            }, CONTROL_REPEAT_INTERVAL_MS);
        }, CONTROL_REPEAT_START_MS);
    });

    button.addEventListener('pointerup', stopPointerScroll);
    button.addEventListener('pointercancel', stopPointerScroll);
    button.addEventListener('pointerleave', stopPointerScroll);

    button.addEventListener('click', event => {
        // Prevent delayed synthetic click after touch interaction.
        event.preventDefault();
    });

    button.addEventListener('dblclick', event => {
        // Suppress accidental browser zoom gestures on rapid taps.
        event.preventDefault();
    });

    button.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        rotateOnce();
    });
}
