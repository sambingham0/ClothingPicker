export const API_BASE_URL = '';
export const IMAGE_BASE_URL = '/images/';
export const CLOTHING_API_URL = '/clothing';

const DEFAULT_LAYER_ADJUSTMENT = { x: 0, y: 0, scale: 1 };

const LAYER_ADJUSTMENTS = {
    outer: { x: 0, y: -5, scale: .4 },
    top: { x: 0, y: 23, scale: .4 },
    bottom: { x: 1, y: 49, scale: .6 }
};

function normalizeType(type) {
    if (!type) return '';
    return String(type).trim().toLowerCase();
}

export const sectionConfig = [
    {
        id: 'outer',
        label: 'Top Layer',
        matchTypes: ['layer'],
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

export const METADATA_FIELDS = [
    { key: 'color', label: 'Color' },
    { key: 'minor_color', label: 'Accent' },
    { key: 'season', label: 'Season' },
    { key: 'occasion', label: 'Occasion' },
    { key: 'fit', label: 'Fit' }
];

export const SECTIONS_BY_TYPE = sectionConfig.reduce((acc, section) => {
    section.matchTypes.forEach(type => {
        const normalizedType = normalizeType(type);
        if (!acc[normalizedType]) {
            acc[normalizedType] = [];
        }
        acc[normalizedType].push(section.id);
    });
    return acc;
}, {});

// top_layer can be worn either as a base top or as an outer layer.
SECTIONS_BY_TYPE.top_layer = ['outer', 'top'];

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

export function mapTypeToSectionIds(type) {
    return SECTIONS_BY_TYPE[normalizeType(type)] || [];
}
