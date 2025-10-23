# 🚀 Quick Start Guide

Get AnyVod up and running in minutes!

## Option 1: Docker Compose (Recommended)

### Prerequisites
- Docker & Docker Compose installed
- TMDB API key from [themoviedb.org](https://www.themoviedb.org/settings/api)

### Steps

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your TMDB_API_KEY
   ```

2. **Start the application**:
   ```bash
   docker-compose up --build
   ```

3. **Access the app**:
   - Frontend: http://localhost:5173
   - API Docs: http://localhost:8000/docs

That's it! 🎉

---

## Option 2: Manual Setup

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Create .env file**:
   ```bash
   echo "TMDB_API_KEY=your_api_key_here" > .env
   ```

5. **Start backend**:
   ```bash
   ./run.sh
   # Or: uvicorn app.main:app --reload
   ```

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
    ```bash
    npm run dev
    ```

4. **Access the app**:
   - Open http://localhost:5173 in your browser

---

## Production Deployment

Use the production Docker Compose file:

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

Frontend will be available on port 80.

---

## Useful Commands

### Docker
```bash
# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild
docker-compose up --build
```

### Development
```bash
# Backend tests
cd backend && pytest

# Frontend build
cd frontend && npm run build
```

---

## Troubleshooting

### "Connection refused" error
- Make sure backend is running on port 8000
- Check firewall settings

### "API key not found" error
- Verify TMDB_API_KEY is set in .env
- Restart the backend service

### Frontend can't connect to backend
- Check VITE_API_BASE in frontend/.env
- Ensure CORS is enabled in backend

---

## Need More Help?

See detailed documentation:
- [DOCKER.md](DOCKER.md) - Docker setup details
- [README.md](README.md) - Full documentation
- [UPDATES.md](UPDATES.md) - Recent changes

---

Happy streaming! 🎬
