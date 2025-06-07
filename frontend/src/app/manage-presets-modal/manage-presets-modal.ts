import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OutfitService, Outfit } from '../services/outfit.service';

@Component({
  selector: 'app-manage-presets-modal',
  templateUrl: './manage-presets-modal.html',
  styleUrl: './manage-presets-modal.css',
  imports: [CommonModule]
})
export class ManagePresetsModal {
  private _visible = false;
  outfits: Outfit[] = [];
  loading = false;

  constructor(private outfitService: OutfitService) {}

  loadOutfits() {
    this.loading = true;
    this.outfitService.getAll().subscribe({
      next: (outfits) => {
        this.outfits = outfits;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading outfits:', error);
        this.loading = false;
      }
    });
  }

  deletePreset(outfit: Outfit) {
    this.outfitService.delete(outfit.id).subscribe({
      next: () => {
        this.outfits = this.outfits.filter(o => o.id !== outfit.id);
      },
      error: (error) => {
        console.error('Error deleting outfit:', error);
      }
    });
  }

  close() {
    this.visible = false;
  }

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.loadOutfits();
    }
  }

  get visible(): boolean {
    return this._visible;
  }
}