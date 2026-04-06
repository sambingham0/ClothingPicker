export const API_BASE_URL = 'http://localhost:8000';
export const IMAGE_BASE_URL = `${API_BASE_URL}/images/`;
export const CLOTHING_API_URL = `${API_BASE_URL}/clothing`;

const DEFAULT_LAYER_ADJUSTMENT = { x: 0, y: 0, scale: 1 };

const LAYER_ADJUSTMENTS = {
    outer: { x: 0, y: -30, scale: 1 },
    top: { x: 0, y: -5, scale: 1 },
    bottom: { x: 0, y: 3, scale: 1.5 }
};

function normalizeType(type) {
    if (!type) return '';
    return String(type).trim().toLowerCase();
}

export const sectionConfig = [
    {
        id: 'outer',
        label: 'Top Layer',
        matchTypes: ['layer', 'top_layer'],
        zIndex: 30,
        controlY: 18
    },
    {
        id: 'top',
        label: 'Top',
        matchTypes: ['top'],
        zIndex: 20,
        controlY: 44
    },
    {
        id: 'bottom',
        label: 'Bottom',
        matchTypes: ['bottom'],
        zIndex: 10,
        controlY: 72
    }
];

export const SECTION_IDS = sectionConfig.map(section => section.id);

export const SECTIONS_BY_Z_INDEX = sectionConfig
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);

export const METADATA_FIELDS = [
    { key: 'color', label: 'Color' },
    { key: 'minor_color', label: 'Accent' },
    { key: 'season', label: 'Season' },
    { key: 'occasion', label: 'Occasion' },
    { key: 'fit', label: 'Fit' }
];

export const SECTION_BY_TYPE = sectionConfig.reduce((acc, section) => {
    section.matchTypes.forEach(type => {
        acc[normalizeType(type)] = section.id;
    });
    return acc;
}, {});

export function createSectionRecord(createValue) {
    return Object.fromEntries(
        SECTION_IDS.map(id => [id, createValue(id)])
    );
}

export function applyLayerAdjustment(slot, sectionId) {
    const adjustment = LAYER_ADJUSTMENTS[sectionId] || DEFAULT_LAYER_ADJUSTMENT;
    const x = Number(adjustment.x) || 0;
    const y = Number(adjustment.y) || 0;
    const scale = Number(adjustment.scale) || 1;

    slot.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
    slot.style.transformOrigin = 'center top';
}

export function mapTypeToSectionId(type) {
    return SECTION_BY_TYPE[normalizeType(type)] || null;
}
