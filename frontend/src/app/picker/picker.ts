import { FormsModule } from '@angular/forms';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ClothesService } from '../services/clothes.service';
import { UploadModal } from '../upload-modal/upload-modal';
import { ManagePresetsModal } from '../manage-presets-modal/manage-presets-modal';
import { UserProfileComponent } from '../components/user-profile/user-profile';
import { OutfitService, Outfit } from '../services/outfit.service';


type Section = 'layers' | 'tops' | 'bottoms';

@Component({
  selector: 'app-picker',
  templateUrl: './picker.html',
  styleUrl: './picker.css',
  imports: [FormsModule, TitleCasePipe, CommonModule, UserProfileComponent, UploadModal, ManagePresetsModal],
})
export class Picker implements OnInit {
  @ViewChild('uploadModal') uploadModal!: UploadModal;
  @ViewChild('managePresetsModal') managePresetsModal!: ManagePresetsModal;

  footerMsg = '';

  clothesIndex: {
    [category: string]: {
      [section in Section]?: string[]
    }
  } = {};

  sections: Section[] = ['layers', 'tops', 'bottoms'];
  categories = ['casual', 'athletic', 'sleep'];

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
    @Inject(OutfitService) private OutfitService: OutfitService
  ) {}

  ngOnInit(): void {
    this.loadClothesData();
  }

  loadClothesData() {
    for (const category of this.categories) {
      this.clothesIndex[category] = {};
      for (const section of this.sections) {
        console.log(`Loading data for ${category}/${section}`);
        this.clothesService.getClothesIndex(category, section).subscribe({
          next: (files: string[]) => {
            console.log(`Successfully loaded ${category}/${section}:`, files);
            this.clothesIndex[category][section] = files;
          },
          error: (error: any[]) => {
            console.error(`Error loading ${category}/${section}:`, error);
            this.clothesIndex[category][section] = [];
          }
        });
      }
    }
  }

  getCurrentImage(section: Section): string | null {
    const category = this.state.activeCategory;
    const idx = this.state.currentIndex[section];
    const files = this.clothesIndex[category]?.[section] || [];
    
    if (files.length > 0 && files[idx]) {
      // Handle both default clothes and user-uploaded clothes
      const imageUrl = files[idx];
      if (imageUrl.startsWith('http')) {
        // Firebase Storage URL
        return imageUrl;
      } else {
        // Local asset URL
        return imageUrl.startsWith('/assets') ? imageUrl : `/assets/clothes/${category}/${section}/${imageUrl}`;
      }
    }
    
    return null;
  }

  cycle(section: Section, delta: number) {
    const category = this.state.activeCategory;
    const files = this.clothesIndex[category]?.[section] || [];
    if (!files.length) return;
    let idx = this.state.currentIndex[section] + delta;
    if (idx < 0) idx = files.length - 1;
    if (idx >= files.length) idx = 0;
    this.state.currentIndex[section] = idx;
  }

  randomize() {
    const category = this.state.activeCategory;
    for (const section of this.sections as Section[]) {
      const files = this.clothesIndex[category]?.[section] || [];
      if (files.length) {
        this.state.currentIndex[section] = Math.floor(Math.random() * files.length);
      }
    }
  }

  toggleLayer() {
    this.state.layerVisible = !this.state.layerVisible;
  }

  savePreset() {
    const currentImages = this.sections
      .map(section => this.getCurrentImage(section))
      .filter((img): img is string => img !== null);
    
    if (currentImages.length === 0) {
      this.footerMsg = 'No items to save!';
      setTimeout(() => this.footerMsg = '', 3000);
      return;
    }

    const outfitName = `${this.state.activeCategory} Outfit ${Date.now()}`;
    
    this.OutfitService.create(outfitName, currentImages).subscribe({
      next: (outfit) => {
        this.footerMsg = 'Preset saved!';
        setTimeout(() => this.footerMsg = '', 3000);
      },
      error: (error) => {
        console.error('Error saving outfit:', error);
        this.footerMsg = 'Error saving preset!';
        setTimeout(() => this.footerMsg = '', 3000);
      }
    });
  }


  openUploadModal() {
    this.uploadModal.visible = true;
  }

  openManagePresetsModal() {
    this.managePresetsModal.visible = true;
  }

  onCategoryChange(category: string) {
    this.state.activeCategory = category;
    // Reset indices when changing category
    this.state.currentIndex = { layers: 0, tops: 0, bottoms: 0 };
  }

  onUploadComplete() {
    // Refresh clothes data after successful upload
    this.loadClothesData();
    this.footerMsg = 'Image uploaded successfully!';
    setTimeout(() => this.footerMsg = '', 3000);
  }
}