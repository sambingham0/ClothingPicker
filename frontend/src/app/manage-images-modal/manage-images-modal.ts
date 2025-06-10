import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClothesService, ClothingItem } from '../services/clothes.service';

@Component({
  selector: 'app-manage-images-modal',
  templateUrl: './manage-images-modal.html',
  styleUrl: './manage-images-modal.css',
  imports: [CommonModule, FormsModule]
})
export class ManageImagesModal {
  private _visible = false;
  loading = false;
  items: ClothingItem[] = [];
  filteredItems: ClothingItem[] = [];
  selectedSection = '';

  sections = ['layers', 'tops', 'bottoms'];

  private clothesService = inject(ClothesService);

  loadItems() {
    this.loading = true;
    this.clothesService.getAllItems().subscribe({
      next: (items) => {
        this.items = items;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading items:', error);
        this.loading = false;
      }
    });
  }

  applyFilters() {
    this.filteredItems = this.items.filter(item => {
      const sectionMatch = !this.selectedSection || this.selectedSection === '' || item.type === this.selectedSection;
      return sectionMatch;
    });
  }

  onFilterChange() {
    this.applyFilters();
  }

  deleteItem(item: ClothingItem) {
    if (!confirm(`Are you sure you want to delete "${item.label || item.filename}"?`)) {
      return;
    }

    this.clothesService.deleteItem(item.id).subscribe({
      next: () => {
        this.loadItems();
      },
      error: (error) => {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
      }
    });
  }

  getImageUrl(item: ClothingItem): string {
    if (item.filename.startsWith('http') || item.filename.startsWith('/')) {
      return item.filename;
    }
    return `/uploads/${item.filename}`;
  }

  close() {
    this.visible = false;
    this.selectedSection = '';
  }

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.loadItems();
    }
  }

  get visible(): boolean {
    return this._visible;
  }
}