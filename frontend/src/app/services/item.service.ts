import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClothingItem {
  id: string;
  type: 'top' | 'bottom' | 'layer';
  filename: string;
  label?: string;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class ItemService {
  private baseUrl = `${environment.apiUrl}/items`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ClothingItem[]> {
    return this.http.get<ClothingItem[]>(this.baseUrl);
  }

  getById(id: string): Observable<ClothingItem> {
    return this.http.get<ClothingItem>(`${this.baseUrl}/${id}`);
  }

  create(
    file: File,
    type: 'top' | 'bottom' | 'layer',
    label?: string
  ): Observable<ClothingItem> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);
    if (label) {
      formData.append('label', label);
    }
    return this.http.post<ClothingItem>(this.baseUrl, formData);
  }

  update(
    id: string,
    file?: File,
    type?: 'top' | 'bottom' | 'layer',
    label?: string
  ): Observable<ClothingItem> {
    const formData = new FormData();
    if (file) {
      formData.append('image', file);
    }
    if (type) {
      formData.append('type', type);
    }
    if (label) {
      formData.append('label', label);
    }
    return this.http.put<ClothingItem>(`${this.baseUrl}/${id}`, formData);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Helper to get full image URL
  getImageUrl(filename: string): string {
    return `${environment.uploadsBaseUrl}/${filename}`;
  }
}
