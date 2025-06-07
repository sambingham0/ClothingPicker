import { Injectable, inject } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from '@angular/fire/storage';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storage: Storage = inject(Storage);
  private authService = inject(AuthService);

  async uploadClothingImage(file: File, category: string, section: string): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be logged in to upload images');
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `users/${user.uid}/clothes/${category}/${section}/${fileName}`;
    
    const storageRef = ref(this.storage, filePath);
    
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  async getUserClothingImages(category: string, section: string): Promise<string[]> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return [];
    }

    const folderPath = `users/${user.uid}/clothes/${category}/${section}`;
    const folderRef = ref(this.storage, folderPath);
    
    try {
      const result = await listAll(folderRef);
      const downloadURLs = await Promise.all(
        result.items.map(item => getDownloadURL(item))
      );
      return downloadURLs;
    } catch (error) {
      console.error('Error fetching user images:', error);
      return [];
    }
  }

  async deleteClothingImage(imageUrl: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be logged in to delete images');
    }

    try {
      const imageRef = ref(this.storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }
}