import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClothesService } from '../services/clothes.service';

@Component({
  selector: 'app-manage-presets-modal',
  templateUrl: './manage-presets-modal.html',
  styleUrl: './manage-presets-modal.css',
  imports: [CommonModule]
})
export class ManagePresetsModal {
  private _visible = false;
  favorites: any[] = [];

  constructor(private clothesService: ClothesService) {
    this.loadFavorites();
  }

  loadFavorites() {
    this.favorites = this.clothesService.loadFavorites();
  }

  deletePreset(idx: number) {
    this.favorites.splice(idx, 1);
    this.clothesService.saveFavorites(this.favorites);
  }

  close() {
    this.visible = false;
  }

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.loadFavorites();
    }
  }

  get visible(): boolean {
    return this._visible;
  }
}