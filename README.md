# ClothingPicker - Personal Styling Assistant

A modern full-stack web application for organizing and selecting clothing outfits with weather integration. Built with Angular 20 frontend and Node.js backend, featuring user authentication, personal image uploads, outfit presets, and real-time weather data to help users choose appropriate clothing.

## Features

### Core Functionality
- **Visual Outfit Selection**: Three-panel interface (Layers, Tops, Bottoms)
- **Category Filtering**: Browse by Casual, Athletic, or Sleep wear categories
- **Random Outfit Generator**: Outfit suggestions based on available items
- **Layer Toggle**: Show/hide layer clothing items for seasonal flexibility
- **Responsive Design**: Desktop-first design that works seamlessly on all devices

### Weather Integration
- **Real-time Weather Data**: OpenWeatherMap API integration for current conditions
- **Geolocation Support**: Automatic location detection with fallback options
- **Weather-based Recommendations**: Outfit suggestions based on temperature and conditions
- **Expandable Weather Widget**: Collapsible weather display with detailed information

### User Management
- **JWT Authentication**: Secure user accounts with email/password registration
- **Personal Image Storage**: Upload and manage your own clothing photos (up to 5MB)
- **User-Specific Data**: Private user uploads and outfit preferences
- **Profile Management**: User profile modal with account settings

### Image Management
- **Multi-format Support**: PNG, JPEG, GIF image upload with validation
- **File Size Validation**: Automatic 5MB size limit with user feedback
- **Secure Storage**: Server-side image storage with UUID-based file naming
- **Image Management Modal**: Organize and delete uploaded clothing items
- **Background Removal**: Integrated background removal for cleaner clothing images

### Outfit Presets
- **Save Favorite Outfits**: Store and name favorite clothing combinations
- **Preset Management**: View, edit, and delete saved outfits through dedicated modal
- **Database Persistence**: Outfits saved per user in PostgreSQL with relational structure
- **Quick Access**: Easily load saved outfits with one click

## Technology Stack

### Frontend (Angular 20)
- **Angular 20**: Latest Angular framework with standalone components architecture
- **TypeScript**: Type-safe development with modern ES6+ features
- **Reactive Forms**: Advanced form validation and user input handling
- **RxJS**: Reactive programming with observables for async operations
- **Modern CSS**: Custom CSS variables with responsive design patterns
- **Component Architecture**: Modular design with reusable components

### Backend (Node.js)
- **Node.js 18+**: Express.js RESTful API server with modern async/await
- **PostgreSQL**: Relational database with UUID primary keys and foreign key relationships
- **JWT Authentication**: JSON Web Token-based secure authentication with bcrypt password hashing
- **Multer**: Advanced file upload handling with validation and storage
- **OpenWeatherMap API**: Real-time weather data integration
- **Background Removal**: Image processing with @imgly/background-removal-node

### Database Schema
- **Users Table**: UUID-based user management with email/password
- **Clothing Items Table**: User-specific clothing with type, category, and file references
- **Outfits Table**: Named outfit collections per user
- **Outfit Items Table**: Many-to-many relationship between outfits and clothing items

### Development & Deployment
- **Angular CLI 20**: Modern build tooling with development server and proxy configuration
- **Docker**: Multi-stage builds for both frontend (Nginx) and backend (Node.js)
- **Docker Compose**: Multi-container orchestration with PostgreSQL, backend, and frontend
- **Docker Hub**: Production-ready container registry deployment
- **Environment Variables**: Secure configuration management for API keys and database connections
- **Nginx**: Production web server with reverse proxy and static file serving