# ClothingPicker - Personal Styling Assistant

A modern web application for organizing and selecting clothing outfits, built with Angular and Firebase. Choose from different clothing categories, upload your own images, and save favorite outfit combinations.

## Features

### Core Functionality
- **Visual Outfit Selection**: Three side-by-side sections (Layers, Tops, Bottoms)
- **Category Filtering**: Browse by Casual, Athletic, or Sleep wear
- **Random Outfit Generator**: Get instant outfit suggestions
- **Layer Toggle**: Show/hide layer clothing items
- **Responsive Design**: Works on desktop and mobile devices

### User Management
- **Firebase Authentication**: Secure user accounts with email/password
- **Personal Image Storage**: Upload and manage your own clothing images
- **User-Specific Data**: Each user's uploads and favorites are private

### Image Management
- **Image Upload**: Add your own clothing photos (up to 5MB)
- **File Validation**: Automatic image type and size validation
- **Cloud Storage**: Images stored securely in Firebase Storage
- **Mixed Content**: Combines default clothing items with user uploads

### Preset Management
- **Save Outfits**: Store favorite clothing combinations
- **Manage Presets**: View and delete saved outfits
- **Persistent Storage**: Favorites saved per user account

## Technology Stack

### Frontend
- **Angular 20**: Modern TypeScript framework
- **Standalone Components**: Latest Angular architecture
- **Reactive Forms**: Form validation and handling
- **RxJS**: Reactive programming with observables

### Backend & Services
- **Firebase Authentication**: User management
- **Firebase Storage**: Image hosting and management
- **Node.js Backend**: Development server and API
- **HTTP Proxy**: Development server integration

### Build & Deployment
- **Angular CLI**: Development and build tooling
- **Firebase Hosting**: Production deployment
- **GitHub Actions**: Automated CI/CD pipeline