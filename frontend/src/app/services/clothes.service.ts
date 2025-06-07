import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, combineLatest, from } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ClothesService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  private authService = inject(AuthService);

  getClothesIndex(category: string, section: string): Observable<string[]> {
    // Get default clothes from backend
    const defaultClothes$ = this.http.get<string[]>(`/api/clothes/${category}/${section}`, {
      responseType: 'json' as const,
      headers: {
        'Accept': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Default clothes:', response)),
      map(files => files.map(file => `/assets/clothes/${category}/${section}/${file}`)),
      catchError(error => {
        console.error('API Error:', error);
        return of([]);
      })
    );

    // Get user's uploaded clothes from Firebase
    const userClothes$ = this.authService.user$.pipe(
      switchMap(user => {
        if (user) {
          return from(this.storageService.getUserClothingImages(category, section));
        } else {
          return of([]);
        }
      }),
      catchError(error => {
        console.error('User clothes error:', error);
        return of([]);
      })
    );

    // Combine both sources
    return combineLatest([defaultClothes$, userClothes$]).pipe(
      map(([defaultClothes, userClothes]) => [...defaultClothes, ...userClothes])
    );
  }

  async uploadClothing(file: File, category: string, section: string): Promise<string> {
    try {
      const downloadURL = await this.storageService.uploadClothingImage(file, category, section);
      return downloadURL;
    } catch (error) {
      throw error;
    }
  }

  loadFavorites(): any[] {
    const user = this.authService.getCurrentUser();
    if (!user) return [];
    
    try {
      const key = `clothesFavorites_${user.uid}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveFavorites(favorites: any[]) {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    
    const key = `clothesFavorites_${user.uid}`;
    localStorage.setItem(key, JSON.stringify(favorites, null, 2));
  }
}