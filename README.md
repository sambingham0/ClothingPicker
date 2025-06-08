# ClothingPicker - Personal Styling Assistant

A modern web application for organizing and selecting clothing outfits, built with Angular frontend and Node.js backend. Choose from different clothing categories, upload your own images, and save favorite outfit combinations.

## Features

### Core Functionality
- **Visual Outfit Selection**: Three side-by-side sections (Layers, Tops, Bottoms)
- **Category Filtering**: Browse by Casual, Athletic, or Sleep wear
- **Random Outfit Generator**: Get instant outfit suggestions
- **Layer Toggle**: Show/hide layer clothing items
- **Responsive Design**: Works on desktop and mobile devices

### User Management
- **JWT Authentication**: Secure user accounts with email/password
- **Personal Image Storage**: Upload and manage your own clothing images
- **User-Specific Data**: Each user's uploads and favorites are private

### Image Management
- **Image Upload**: Add your own clothing photos (up to 5MB)
- **File Validation**: Automatic image type and size validation
- **Local Storage**: Images stored securely on the server
- **Mixed Content**: Combines default clothing items with user uploads

### Preset Management
- **Save Outfits**: Store favorite clothing combinations
- **Manage Presets**: View and delete saved outfits
- **Database Storage**: Favorites saved per user account in PostgreSQL

## Technology Stack

### Frontend
- **Angular 20**: Modern TypeScript framework
- **Standalone Components**: Latest Angular architecture
- **Reactive Forms**: Form validation and handling
- **RxJS**: Reactive programming with observables

### Backend & Database
- **Node.js**: Express.js RESTful API server
- **PostgreSQL**: Relational database for user data and outfit management
- **JWT Authentication**: JSON Web Token-based user authentication
- **Multer**: File upload handling for images
- **bcrypt**: Password hashing and security

### Development & Deployment
- **Angular CLI**: Development and build tooling
- **Docker**: Containerization for both frontend and backend
- **Docker Compose**: Multi-container application orchestration
- **Nginx**: Production web server and reverse proxy
- **Development Proxy**: Frontend-to-backend API communication