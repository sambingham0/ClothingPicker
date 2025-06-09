import { Component, inject, EventEmitter, Output } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ClothesService } from '../services/clothes.service';

@Component({
  selector: 'app-upload-modal',
  templateUrl: './upload-modal.html',
  styleUrl: './upload-modal.css',
  imports: [FormsModule, CommonModule]
})
export class UploadModal {
  visible = false;
  uploading = false;
  errorMessage = '';
  selectedFiles: File[] = [];
  
  @Output() uploadComplete = new EventEmitter<void>();
  
  private clothesService = inject(ClothesService);

  onFileSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    // Validate each file
    this.selectedFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) return false;
      if (!file.type.startsWith('image/')) return false;
      return true;
    });
  }

  async onSubmit(form: NgForm) {
    if (!form.valid || this.selectedFiles.length === 0) return;

    this.uploading = true;
    this.errorMessage = '';

    const { category, section } = form.value;

    try {
      // Upload each file sequentially
      for (const file of this.selectedFiles) {
        await this.clothesService.uploadClothing(file, category, section).toPromise();
      }
      
      this.uploadComplete.emit();
      this.close();
    } catch (error: any) {
      this.errorMessage = error.error?.error || 'Upload failed';
    } finally {
      this.uploading = false;
    }
  }

  close() {
    this.visible = false;
    this.errorMessage = '';
    this.selectedFiles = [];
    this.uploading = false;
    
    // Reset form
    const form = document.querySelector('#upload-form') as HTMLFormElement;
    if (form) {
      form.reset();
    }
  }
}