import { FormsModule } from '@angular/forms';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ClothesService, ClothingItem } from '../services/clothes.service';
import { UploadModal } from '../upload-modal/upload-modal';
import { ManageImagesModal } from '../manage-images-modal/manage-images-modal';
import { ManagePresetsModal } from '../manage-presets-modal/manage-presets-modal';
import { NamePresetModal } from '../name-preset-modal/name-preset-modal';
import { UserProfileModal } from '../user-profile-modal/user-profile-modal';
import { OutfitService, Outfit } from '../services/outfit.service';
import { ClickOutsideDirective } from '../directives/click-outside.directive';
import { WeatherModal } from '../weather-modal/weather-modal';

type Section = 'layers' | 'tops' | 'bottoms';

@Component({
  selector: 'app-picker',
  templateUrl: './picker.html',
  styleUrl: './picker.css',
  imports: [FormsModule, TitleCasePipe, CommonModule, UserProfileModal, UploadModal, ManageImagesModal ,ManagePresetsModal, NamePresetModal, WeatherModal, ClickOutsideDirective],
})
export class Picker implements OnInit {
  @ViewChild('uploadModal') uploadModal!: UploadModal;
  @ViewChild('manageImagesModal') manageImagesModal!: ManageImagesModal;
  @ViewChild('managePresetsModal') managePresetsModal!: ManagePresetsModal;
  @ViewChild('namePresetModal') namePresetModal!: NamePresetModal;
  @ViewChild('userProfileModal') userProfileModal!: UserProfileModal;

  footerMsg = '';

  clothesIndex: {
    [category: string]: {
      [section in Section]?: ClothingItem[]
    }
  } = {};

  sections: Section[] = ['layers', 'tops', 'bottoms'];
  categories = ['casual', 'athletic', 'sleep', 'presets'];
  
  // Store loaded presets
  presets: Outfit[] = [];
  currentPresetIndex = 0;

  // Track if presets menu is open
  presetsMenuOpen = false;

  // Track if uploads menu is open
  uploadsMenuOpen = false;

  // Store pending preset images for modal workflow
  private pendingPresetImages: string[] | null = null;

  state = {
    activeCategory: 'casual',
    currentIndex: {
      layers: 0,
      tops: 0,
      bottoms: 0
    },
    layerVisible: true
  };

  constructor(
    private clothesService: ClothesService,
    private OutfitService: OutfitService
  ) {}

  ngOnInit(): void {
    this.loadClothesData();
    this.loadPresets();
  }

  loadClothesData() {
    for (const category of this.categories) {
      if (category === 'presets') continue; // Skip presets category for clothes loading
      
      this.clothesIndex[category] = {};
      for (const section of this.sections) {
        console.log(`Loading data for ${category}/${section}`);
        this.clothesService.getClothesIndex(category, section).subscribe({
          next: (items: ClothingItem[]) => {
            console.log(`Successfully loaded ${category}/${section}:`, items);
            this.clothesIndex[category][section] = items;
          },
          error: (error: any) => {
            console.error(`Error loading ${category}/${section}:`, error);
            this.clothesIndex[category][section] = [];
          }
        });
      }
    }
  }

  loadPresets() {
    this.OutfitService.getAll().subscribe({
      next: (outfits) => {
        this.presets = outfits;
      },
      error: (error) => {
        console.error('Error loading presets:', error);
        this.presets = [];
      }
    });
  }

  getCurrentImage(section: Section): string | null {
    // Special handling for presets category
    if (this.state.activeCategory === 'presets') {
      if (this.presets.length === 0) return null;
      
      const currentPreset = this.presets[this.currentPresetIndex];
      if (!currentPreset || !currentPreset.items) return null;
      
      // Debug logging to see what we're working with
      console.log('Current preset:', currentPreset);
      console.log('Looking for section:', section);
      
      // Find item for this section in the preset
      const item = currentPreset.items.find(item => {
        // Map item types to sections
        const typeToSection: { [key: string]: Section } = {
          'layers': 'layers',
          'tops': 'tops', 
          'bottoms': 'bottoms'
        };
        return typeToSection[item.type] === section;
      });
      
      console.log('Found item for section:', item);
      
      if (item) {
        // With Angular proxy, just use /uploads/ directly - proxy handles the routing
        if (item.filename.startsWith('http') || item.filename.startsWith('/')) {
          return item.filename;
        }
        // Otherwise, construct the URL with /uploads/ prefix
        return `/uploads/${item.filename}`;
      }
      return null;
    }
    
    // Original logic for non-preset categories
    const category = this.state.activeCategory;
    const idx = this.state.currentIndex[section];
    const items = this.clothesIndex[category]?.[section] || [];
    
    if (items.length === 0) return null;
    return items[idx]?.url || null;
  }
      

  cycle(section: Section, delta: number) {
    // Special handling for presets category
    if (this.state.activeCategory === 'presets') {
      // For presets, cycle through different presets instead of individual items
      if (this.presets.length === 0) return;
      
      this.currentPresetIndex = (this.currentPresetIndex + delta + this.presets.length) % this.presets.length;
      return;
    }
    
    // Original logic for non-preset categories
    const category = this.state.activeCategory;
    const items = this.clothesIndex[category]?.[section] || [];
    
    if (items.length === 0) return;
    
    this.state.currentIndex[section] = 
      (this.state.currentIndex[section] + delta + items.length) % items.length;
}

  randomize() {
    const category = this.state.activeCategory;
    
    // Handle presets category differently
    if (category === 'presets') {
      if (this.presets.length > 0) {
        this.currentPresetIndex = Math.floor(Math.random() * this.presets.length);
      }
      return;
    }
    
    // Regular category handling
    for (const section of this.sections as Section[]) {
      const items = this.clothesIndex[category]?.[section] || [];
      if (items.length) {
        this.state.currentIndex[section] = Math.floor(Math.random() * items.length);
      }
    }
  }

  toggleLayer() {
    this.state.layerVisible = !this.state.layerVisible;
  }

  savePreset() {
    console.log('savePreset() called');
    console.log('Active category:', this.state.activeCategory);
    console.log('namePresetModal:', this.namePresetModal);
    
    // Prevent saving when viewing presets
    if (this.state.activeCategory === 'presets') {
      console.log('Cannot save - in presets category');
      this.footerMsg = 'Cannot save preset while viewing presets!';
      setTimeout(() => this.footerMsg = '', 3000);
      return;
    }
    
    // Get current image URLs instead of IDs
    const currentImages = this.sections
      .map(section => {
        const category = this.state.activeCategory;
        const idx = this.state.currentIndex[section];
        const items = this.clothesIndex[category]?.[section] || [];
        return items[idx]?.url;
      })
      .filter(url => url !== undefined);
    
    console.log('Current images:', currentImages);
    
    if (currentImages.length === 0) {
      console.log('No items to save');
      this.footerMsg = 'No items to save!';
      setTimeout(() => this.footerMsg = '', 3000);
      return;
    }

    console.log('Opening name preset modal');
    console.log('namePresetModal before setting visible:', this.namePresetModal);
    
    // Store current images for when modal completes
    this.pendingPresetImages = currentImages;
    this.namePresetModal.visible = true;
  }

  openManagePresetsModal() {
    this.managePresetsModal.visible = true;
  }

  openUserProfileModal() {
    this.userProfileModal.visible = true;
  }

  togglePresetsMenu() {
    this.presetsMenuOpen = !this.presetsMenuOpen;
  }

  openPresetsMenu() {
    this.presetsMenuOpen = true;
  }

  closePresetsMenu() {
    this.presetsMenuOpen = false;
  }

  toggleUploadsMenu() {
    this.uploadsMenuOpen = !this.uploadsMenuOpen;
  }

  openUploadsMenu() {
    this.uploadsMenuOpen = true;
  }

  closeUploadsMenu() {
    this.uploadsMenuOpen = false;
  }

  openUploadModal() {
    this.uploadModal.visible = true;
    this.closeUploadsMenu();
  }

  openManageImagesModal() {
    this.manageImagesModal.visible = true;
    this.closeUploadsMenu();
  }

  onCategoryChange(category: string) {
    this.state.activeCategory = category;
    
    if (category === 'presets') {
      // Reset to first preset when switching to presets
      this.currentPresetIndex = 0;
      // Reload presets to make sure we have latest data
      this.loadPresets();
    } else {
      // Reset indices when changing to regular category
      this.state.currentIndex = { layers: 0, tops: 0, bottoms: 0 };
    }
  }

  onUploadComplete() {
    // Refresh clothes data after successful upload
    this.loadClothesData();
    this.footerMsg = 'Image uploaded successfully!';
    setTimeout(() => this.footerMsg = '', 3000);
  }

  // Event handlers for name preset modal
  onPresetNamed(name: string) {
    if (this.pendingPresetImages) {
      this.OutfitService.create(name, this.pendingPresetImages).subscribe({
        next: (outfit) => {
          this.footerMsg = `Preset "${name}" saved!`;
          setTimeout(() => this.footerMsg = '', 3000);
          this.loadPresets();
        },
        error: (error) => {
          console.error('Error saving outfit:', error);
          this.footerMsg = 'Error saving preset!';
          setTimeout(() => this.footerMsg = '', 3000);
        }
      });
      this.pendingPresetImages = null;
    }
  }

  onPresetNameCancelled() {
    this.pendingPresetImages = null;
    this.footerMsg = 'Preset save cancelled.';
    setTimeout(() => this.footerMsg = '', 3000);
  }

  // Get current preset name for display
  getCurrentPresetName(): string {
    if (this.state.activeCategory === 'presets' && this.presets.length > 0) {
      return this.presets[this.currentPresetIndex]?.name || 'Unnamed Preset';
    }
    return '';
  }

  // Get preset count info
  getPresetInfo(): string {
    if (this.state.activeCategory === 'presets') {
      if (this.presets.length === 0) return 'No presets available';
      return `${this.currentPresetIndex + 1} of ${this.presets.length}`;
    }
    return '';
  }
}