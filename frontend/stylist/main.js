import {
    API_BASE_URL,
    IMAGE_BASE_URL,
    CLOTHING_API_URL,
    SECTION_IDS,
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
    const items = getItems(state, sectionId);
    const isDeleting = state.deleting[sectionId] === true;
    const generatedValue = state.generatedOutfit[sectionId];
    const item = state.generatedOutfitActive
        ? items.find(entry => entry.id === generatedValue) || null
        : getCurrentItem(state, sectionId);

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
        slot.style.display = 'block';
    }
}

function renderSections() {
    SECTION_IDS.forEach(sectionId => {
        renderSection(sectionId);
    });
}

function applyOutfitBySection(sectionOutfit) {
    if (!sectionOutfit || typeof sectionOutfit !== 'object') {
        alert('No outfit could be generated.');
        return;
    }

    SECTION_IDS.forEach(sectionId => {
        const targetId = sectionOutfit[sectionId];
        state.generatedOutfit[sectionId] = typeof targetId === 'number' ? targetId : null;
    });
    state.generatedOutfitActive = true;

    renderSections();
}

async function generateOutfitFromServer() {
    if (state.generateBtn) {
        state.generateBtn.disabled = true;
        state.generateBtn.textContent = 'Generating...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/generate-outfit`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(payload.detail || payload.message || `Request failed (${response.status})`);
        }

        applyOutfitBySection(payload.sections || {});
    } catch (error) {
        console.error('Error generating outfit:', error);
        alert(`Could not generate outfit: ${error.message || error}`);
    } finally {
        if (state.generateBtn) {
            state.generateBtn.disabled = false;
            state.generateBtn.textContent = 'Generate Outfit';
        }
    }
}

function rotateSection(sectionId, direction) {
    state.generatedOutfitActive = false;
    state.generatedOutfit[sectionId] = null;
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

function buildSections() {
    state.sectionElements = {};
    state.canvasSlots = {};

    state.generateBtn = document.getElementById('generate-outfit-btn');

    if (state.generateBtn) {
        state.generateBtn.onclick = generateOutfitFromServer;
    }

    sectionConfig.forEach(cfg => {
        const sectionRoot = document.querySelector(`.outfit-section[data-section-id="${cfg.id}"]`);
        const controlsRoot = document.querySelector(`.canvas-toggle-group[data-section-id="${cfg.id}"]`);
        const slot = document.querySelector(`.canvas-layer[data-section-id="${cfg.id}"]`);

        if (controlsRoot) {
            controlsRoot.style.top = `${cfg.controlY}%`;
        }

        if (slot) {
            slot.style.zIndex = String(cfg.zIndex);
            applyLayerAdjustment(slot, cfg.id);
            state.canvasSlots[cfg.id] = slot;
        }

        if (!sectionRoot) return;

        const status = sectionRoot.querySelector('.item-status');
        const deleteBtn = sectionRoot.querySelector('.meta-delete-btn');
        const prevBtn = controlsRoot ? controlsRoot.querySelector('[data-action="prev"]') : null;
        const nextBtn = controlsRoot ? controlsRoot.querySelector('[data-action="next"]') : null;
        const metadataValues = Object.fromEntries(
            METADATA_FIELDS.map(field => [
                field.key,
                sectionRoot.querySelector(`[data-metadata-key="${field.key}"]`)
            ])
        );

        if (prevBtn) prevBtn.onclick = () => rotateSection(cfg.id, -1);
        if (nextBtn) nextBtn.onclick = () => rotateSection(cfg.id, 1);
        if (deleteBtn) deleteBtn.onclick = () => deleteCurrentItem(cfg.id);

        state.sectionElements[cfg.id] = {
            root: sectionRoot,
            prevBtn,
            nextBtn,
            deleteBtn,
            status,
            metadataValues
        };
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