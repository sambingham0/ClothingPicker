import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ClothingItem {
  id: number;
  url: string;
  type: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClothesService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getClothesIndex(category: string, section: string): Observable<ClothingItem[]> {
    return this.http.get<ClothingItem[]>(`${this.apiUrl}/clothes/${category}/${section}`);
  }

  uploadClothing(file: File, category: string, section: string): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('section', section);

    return this.http.post<{url: string}>(`${this.apiUrl}/clothes/upload`, formData).pipe(
      map(response => response.url)
    );
  }

  deleteClothing(imageUrl: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/clothes`, {
      body: { imageUrl }
    });
  }

  getCategories(): string[] {
    return ['casual', 'athletic', 'sleep'];
  }

  getSections(): string[] {
    return ['layers', 'tops', 'bottoms'];
  }

  isUserImage(imageUrl: string): boolean {
    return imageUrl.includes('/uploads/') || imageUrl.startsWith('http');
  }
}