import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClothingItem } from './item.service';

export interface Outfit {
  id: string;
  name: string;
  created_at: string;
  items: ClothingItem[];
}

@Injectable({
  providedIn: 'root',
})
export class OutfitService {
  private baseUrl = `${environment.apiUrl}/outfits`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Outfit[]> {
    return this.http.get<Outfit[]>(this.baseUrl);
  }

  create(name: string, items: string[]): Observable<Outfit> {
    return this.http.post<Outfit>(this.baseUrl, { name, items });
  }

  update(id: string, name?: string, items?: string[]): Observable<Outfit> {
    return this.http.put<Outfit>(`${this.baseUrl}/${id}`, { name, items });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
