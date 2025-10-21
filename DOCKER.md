# Docker Compose Setup for AnyVod

This guide explains how to run AnyVod using Docker Compose.

## Prerequisites

- Docker installed (version 20.10 or higher)
- Docker Compose installed (version 2.0 or higher)
- TMDB API key (get one from https://www.themoviedb.org/settings/api)

## Quick Start

1. **Clone the repository** (if you haven't already):
   ```bash
   cd AnyVod
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file** and add your TMDB API key:
   ```
   TMDB_API_KEY=your_actual_api_key_here
   ```

4. **Build and start the containers**:
   ```bash
   docker-compose up --build
   ```

5. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Docker Compose Commands

### Start services (detached mode)
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

### Rebuild containers
```bash
docker-compose up --build
```

### Remove containers and volumes
```bash
docker-compose down -v
```

## Services

### Backend (FastAPI)
- **Container**: `anyvod-backend`
- **Port**: 8000
- **Technology**: Python 3.11 + FastAPI
- **Features**:
  - TMDB API proxy
  - vidsrc embed builder
  - Auto-reload in development

### Frontend (React + Vite)
- **Container**: `anyvod-frontend`
- **Port**: 5173 (mapped to 80 inside container)
- **Technology**: React 19 + Vite + Nginx
- **Features**:
  - Production-optimized build
  - Nginx serving static files
  - Client-side routing support

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
TMDB_API_KEY=your_tmdb_api_key_here
```

### Custom API Base URL

To change the backend URL for the frontend:

```bash
docker-compose build --build-arg VITE_API_BASE=http://your-backend-url:8000 frontend
```

### Port Configuration

To change exposed ports, edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8080:8000"  # Change 8080 to your preferred port
  
  frontend:
    ports:
      - "3000:80"    # Change 3000 to your preferred port
```

## Development Mode

For development with hot-reload:

1. Use the volume mounts already configured in `docker-compose.yml`
2. Changes to source code will automatically reload

### Backend Hot-Reload
The backend uses `--reload` flag, so any changes to Python files will restart the server.

### Frontend Development
For frontend development, you might prefer running Vite dev server locally:

```bash
cd frontend
npm install
npm run dev
```

## Production Deployment

For production deployment:

1. **Remove volume mounts** from `docker-compose.yml` to prevent code changes:
   ```yaml
   # Comment out or remove:
   # volumes:
   #   - ./backend:/app
   ```

2. **Use production CORS settings** in `backend/app/main.py`:
   ```python
   origins = [
       "https://yourdomain.com",
   ]
   ```

3. **Set production API URL**:
   ```bash
   docker-compose build --build-arg VITE_API_BASE=https://api.yourdomain.com frontend
   ```

4. **Use environment variables for secrets**:
   ```bash
   docker-compose up -d
   ```

## Troubleshooting

### Backend fails to start
- Check if TMDB_API_KEY is set in `.env`
- View logs: `docker-compose logs backend`
- Ensure port 8000 is not in use

### Frontend can't connect to backend
- Check backend is running: `docker-compose ps`
- Verify VITE_API_BASE is correct
- Check CORS settings in backend

### Network errors
- Ensure both services are on the same network
- Try rebuilding: `docker-compose up --build`

### Port conflicts
- Check if ports 5173 or 8000 are already in use
- Change ports in `docker-compose.yml`

## Health Checks

The backend service includes a health check:

```bash
docker-compose ps
```

Should show "healthy" status for the backend after startup.

## Logs and Debugging

### Access container shell
```bash
# Backend
docker-compose exec backend /bin/bash

# Frontend
docker-compose exec frontend /bin/sh
```

### View real-time logs
```bash
docker-compose logs -f --tail=100
```

## Cleanup

### Stop and remove containers
```bash
docker-compose down
```

### Remove all data (containers, networks, volumes)
```bash
docker-compose down -v
```

### Remove images
```bash
docker-compose down --rmi all
```

## Network Architecture

```
┌─────────────────────────────────────┐
│  Docker Network: anyvod-network     │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │   Backend    │  │  Frontend   │ │
│  │  (FastAPI)   │  │ (Nginx)     │ │
│  │  Port: 8000  │  │  Port: 80   │ │
│  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────┘
         │                   │
         └───────┬───────────┘
                 │
         Host Ports: 8000, 5173
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [TMDB API Documentation](https://developers.themoviedb.org/3)

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Ensure Docker and Docker Compose are up to date
4. Check that required ports are available
