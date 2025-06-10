import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';

@Injectable()
export class WeatherInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    // Add any weather API specific headers or transformations here
    if (req.url.includes('/api/weather')) {
      const modifiedReq = req.clone({
        setHeaders: {
          'Accept': 'application/json'
        }
      });
      return next.handle(modifiedReq);
    }
    
    return next.handle(req);
  }
}