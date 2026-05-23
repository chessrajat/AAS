# Advance Annotation System (AAS)

[![Status](https://img.shields.io/badge/status-active-brightgreen)](#)
[![Frontend](https://img.shields.io/badge/frontend-Next.js-black)](#)
[![Backend](https://img.shields.io/badge/backend-Django%20REST-0C4B33)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](#)

🎯 **AAS** is an open-source image annotation platform for creating, reviewing, and exporting bounding-box labels. It supports manual annotation today and is evolving toward model-assisted auto-annotation workflows.

## ✨ Highlights
- 🖼️ Upload images and label them with bounding boxes.
- 🗂️ Manage projects and class labels with custom colors.
- 📦 Export YOLO-compatible datasets.
- 🤖 Configure auto-annotation with YOLO models and class mappings.

## 🧱 Tech Stack
- **Frontend:** Next.js (JavaScript/JSX)
- **Backend:** Django + Django REST Framework
- **Model Runtime:** Ultralytics YOLO

## 📁 Project Structure
```
backend/      # Django + DRF API
frontend/     # Next.js UI
```

## 🚀 Quickstart

### 1) Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```

App runs at:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### Docker
Run the full stack with the default CPU-compatible worker:
```bash
docker compose up --build
```

The Docker stack is served through nginx:
- App: `http://localhost/`
- LAN access: `http://<server-ip>/`
- MinIO console: `http://localhost:9001/`

On a machine with NVIDIA Container Toolkit configured, run the worker with GPU access:
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

The GPU override sets `YOLO_DEVICE=0` for the training worker. Without the override, Ultralytics uses its default device detection and falls back to CPU.

## 🔐 Auth
This project uses JWT auth endpoints:
- `POST /api/auth/token/`
- `POST /api/auth/token/refresh/`

## 🧩 Core API Endpoints

### Projects & Labels
- `GET/POST /api/annotate/projects/`
- `GET/PUT/PATCH/DELETE /api/annotate/projects/{id}/`
- `POST /api/annotate/projects/{id}/classes/`
- `GET /api/annotate/projects/{id}/export/`

### Images & Annotations
- `GET/POST /api/annotate/projects/{id}/images/`
- `GET/POST /api/annotate/images/{id}/annotations/`
- `PATCH/DELETE /api/annotate/annotations/{id}/`
- `DELETE /api/annotate/images/{id}/`

### Models
- `GET/POST /api/annotate/models/`
- `GET/PUT/PATCH/DELETE /api/annotate/models/{id}/`

### Auto-Annotate Configuration
- `GET/POST /api/annotate/projects/{id}/auto-annotate/configs/`
- `PUT/PATCH/DELETE /api/annotate/projects/{id}/auto-annotate/configs/{config_id}/`
- `POST /api/annotate/projects/{id}/auto-annotate/run/`

## 🧠 Auto-Annotate Flow
1. Upload a YOLO model (classes auto-extracted).
2. Map model classes to project classes.
3. Run auto-annotation to generate boxes for all project images.

## 🛠️ Development Notes
- Large image batches are supported: `DATA_UPLOAD_MAX_NUMBER_FILES = 2000`.
- Auto-annotation uses the configured YOLO model and class mappings.

## 🤝 Contributing
Contributions are welcome! Open issues or submit PRs for fixes and enhancements.

## 📄 License
MIT
