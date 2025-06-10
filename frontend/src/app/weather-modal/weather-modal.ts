import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
}

@Component({
  selector: 'app-weather-modal',
  templateUrl: './weather-modal.html',
  styleUrl: './weather-modal.css',
  imports: [CommonModule]
})
export class WeatherModal implements OnInit {
  visible = false;
  loading = false;
  error = '';
  weatherData: WeatherData | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadWeatherData();
  }

  loadWeatherData() {
    this.loading = true;
    this.error = '';
    
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          this.fetchWeatherData(lat, lon);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to a default location
          this.fetchWeatherData(40.7128, -74.0060); // New York City
        }
      );
    } else {
      // Fallback for browsers that don't support geolocation
      this.fetchWeatherData(40.7128, -74.0060); // New York City
    }
  }

  private fetchWeatherData(lat: number, lon: number) {
    const url = `${environment.apiUrl}/weather?lat=${lat}&lon=${lon}`;

    this.http.get<WeatherData>(url).subscribe({
      next: (data) => {
        this.weatherData = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching weather:', error);
        this.error = 'Unable to load weather data';
        this.loading = false;
      }
    });
  }

  toggle() {
    this.visible = !this.visible;
  }

  close() {
    this.visible = false;
  }

  refresh() {
    this.loadWeatherData();
  }
}