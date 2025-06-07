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
  selectedFile: File | null = null;
  
  @Output() uploadComplete = new EventEmitter<void>();
  
  private clothesService = inject(ClothesService);

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'File size must be less than 5MB';
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'File must be an image';
        return;
      }

      this.selectedFile = file;
      this.errorMessage = '';
    }
  }

  async onSubmit(form: NgForm) {
    if (!form.valid || this.uploading || !this.selectedFile) {
      return;
    }

    this.uploading = true;
    this.errorMessage = '';
    
    try {
      const formValue = form.value;
      await this.clothesService.uploadClothing(
        this.selectedFile, 
        formValue.category, 
        formValue.section
      );
      
      this.close();
      this.uploadComplete.emit();
    } catch (error: any) {
      console.error('Upload failed:', error);
      this.errorMessage = error.message || 'Upload failed. Please try again.';
    } finally {
      this.uploading = false;
    }
  }

  close() {
    this.visible = false;
    this.errorMessage = '';
    this.selectedFile = null;
    this.uploading = false;
    
    // Reset form
    const form = document.querySelector('#upload-form') as HTMLFormElement;
    if (form) {
      form.reset();
    }
  }
}