import {
    IMAGE_BASE_URL,
    CLOTHING_API_URL,
    SECTION_IDS,
    SECTIONS_BY_Z_INDEX,
    METADATA_FIELDS,
    sectionConfig,
    applyLayerAdjustment
} from './config.js';
import {
    createState,
    getItems,
    getCurrentItem,
    rotateSectionState,
    removeCurrentItemFromSection,
    groupClothesBySection
} from './store.js';

const state = createState();

function formatMetadataValue(value) {
    if (Array.isArray(value)) {
        const cleaned = value
            .map(item => String(item || '').trim())
            .filter(Boolean);
        return cleaned.length ? cleaned.join(', ') : '-';
    }

    if (value === null || value === undefined) return '-';
    const text = String(value).trim();
    return text || '-';
}

function renderMetadata(section, item) {
    if (!section || !section.metadataValues) return;

    METADATA_FIELDS.forEach(field => {
        const target = section.metadataValues[field.key];
        if (!target) return;
        target.textContent = formatMetadataValue(item ? item[field.key] : null);
    });
}

function renderSection(sectionId) {
    const section = state.sectionElements[sectionId];
    const slot = state.canvasSlots[sectionId];
    const item = getCurrentItem(state, sectionId);
    const items = getItems(state, sectionId);
    const isDeleting = state.deleting[sectionId] === true;

    if (!section) return;

    renderMetadata(section, item);
    const disableNavigation = isDeleting || items.length <= 1;

    if (section.prevBtn) section.prevBtn.disabled = disableNavigation;
    if (section.nextBtn) section.nextBtn.disabled = disableNavigation;

    if (section.deleteBtn) {
        section.deleteBtn.disabled = isDeleting || !item;
        section.deleteBtn.textContent = isDeleting ? 'Deleting...' : 'Delete';
    }

    if (!items.length) {
        section.status.textContent = 'No items';
    } else {
        section.status.textContent = `${state.activeIndex[sectionId] + 1}/${items.length}`;
    }

    if (!slot) return;

    if (!item) {
        slot.style.display = 'none';
        slot.removeAttribute('src');
        slot.alt = '';
    } else {
        slot.src = IMAGE_BASE_URL + item.image_path;
        slot.alt = item.type || 'Clothing item';
        slot.style.display = '';
    }
}

function renderSections() {
    SECTION_IDS.forEach(sectionId => {
        renderSection(sectionId);
    });
}

function rotateSection(sectionId, direction) {
    const changed = rotateSectionState(state, sectionId, direction);
    if (!changed) return;
    renderSections();
}

async function deleteCurrentItem(sectionId) {
    if (state.deleting[sectionId]) return;

    const item = getCurrentItem(state, sectionId);
    if (!item || typeof item.id !== 'number') {
        alert('No deletable item selected.');
        return;
    }

    const itemType = item.type || 'item';
    const confirmed = window.confirm(`Delete this ${itemType}? This cannot be undone.`);
    if (!confirmed) return;

    state.deleting[sectionId] = true;
    renderSections();

    try {
        const response = await fetch(`${CLOTHING_API_URL}/${item.id}`, {
            method: 'DELETE'
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.deleted) {
            const message = payload.status || `Request failed (${response.status})`;
            throw new Error(message);
        }

        removeCurrentItemFromSection(state, sectionId);
    } catch (error) {
        console.error('Error deleting clothing item:', error);
        alert(`Could not delete item: ${error.message || error}`);
    } finally {
        state.deleting[sectionId] = false;
        renderSections();
    }
}

function createToggleButton(symbol, label, onClick) {
    const button = document.createElement('button');
    button.className = 'toggle-btn';
    button.type = 'button';
    button.textContent = symbol;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', onClick);
    return button;
}

function createCanvasControls(cfg) {
    const controls = document.createElement('div');
    controls.className = 'canvas-toggle-group';
    controls.style.top = `${cfg.controlY}%`;

    const prevBtn = createToggleButton('‹', `Previous ${cfg.label} item`, () => rotateSection(cfg.id, -1));
    prevBtn.classList.add('canvas-toggle-btn');

    const nextBtn = createToggleButton('›', `Next ${cfg.label} item`, () => rotateSection(cfg.id, 1));
    nextBtn.classList.add('canvas-toggle-btn');

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);

    return {
        root: controls,
        prevBtn,
        nextBtn
    };
}

function createMetadataPanel(sectionLabel) {
    const metadata = document.createElement('div');
    metadata.className = 'outfit-meta';
    const values = {};

    METADATA_FIELDS.forEach(field => {
        const row = document.createElement('div');
        row.className = 'meta-row';

        const label = document.createElement('span');
        label.className = 'meta-label';
        label.textContent = `${field.label}:`;

        const value = document.createElement('span');
        value.className = 'meta-value';
        value.textContent = '-';

        row.appendChild(label);
        row.appendChild(value);
        metadata.appendChild(row);

        values[field.key] = value;
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'meta-delete-btn';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${sectionLabel}`);
    metadata.appendChild(deleteBtn);

    return {
        root: metadata,
        values,
        deleteBtn
    };
}

function createSectionControls(cfg, canvasControls) {
    const sectionRoot = document.createElement('section');
    sectionRoot.className = 'outfit-section';

    const title = document.createElement('h2');
    title.className = 'outfit-title';
    title.textContent = cfg.label;

    const row = document.createElement('div');
    row.className = 'outfit-controls-row';

    const status = document.createElement('div');
    status.className = 'item-status';
    status.textContent = '-/-';
    const metadata = createMetadataPanel(cfg.label);
    metadata.deleteBtn.addEventListener('click', () => deleteCurrentItem(cfg.id));

    row.appendChild(status);
    row.appendChild(metadata.root);

    sectionRoot.appendChild(title);
    sectionRoot.appendChild(row);

    return {
        root: sectionRoot,
        prevBtn: canvasControls ? canvasControls.prevBtn : null,
        nextBtn: canvasControls ? canvasControls.nextBtn : null,
        deleteBtn: metadata.deleteBtn,
        status,
        metadataValues: metadata.values
    };
}

function buildSections() {
    const root = document.getElementById('outfit-stack');
    root.innerHTML = '';
    state.sectionElements = {};
    state.canvasSlots = {};

    const canvas = document.createElement('section');
    canvas.className = 'outfit-canvas';
    canvas.setAttribute('aria-label', 'Outfit preview');
    const canvasControlsBySection = {};

    SECTIONS_BY_Z_INDEX.forEach(cfg => {
        const layer = document.createElement('img');
        layer.className = 'canvas-layer';
        layer.style.zIndex = String(cfg.zIndex);
        layer.alt = '';
        layer.style.display = 'none';
        applyLayerAdjustment(layer, cfg.id);
        canvas.appendChild(layer);
        state.canvasSlots[cfg.id] = layer;

        const canvasControls = createCanvasControls(cfg);
        canvas.appendChild(canvasControls.root);
        canvasControlsBySection[cfg.id] = canvasControls;
    });

    const controlsStack = document.createElement('section');
    controlsStack.className = 'controls-stack';

    root.appendChild(canvas);
    root.appendChild(controlsStack);

    sectionConfig.forEach(cfg => {
        const canvasControls = canvasControlsBySection[cfg.id] || null;
        const sectionElements = createSectionControls(cfg, canvasControls);

        controlsStack.appendChild(sectionElements.root);
        state.sectionElements[cfg.id] = sectionElements;
    });
}

async function loadClothingImages() {
    try {
        const clothes = await fetch(CLOTHING_API_URL).then(res => res.json());
        state.groupedItems = groupClothesBySection(clothes);
        buildSections();
        renderSections();
    } catch (error) {
        console.error('Error fetching clothing:', error);
        alert('Error fetching clothing: ' + error);
    }
}

loadClothingImages();