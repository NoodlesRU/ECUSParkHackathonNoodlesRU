# Information Credibility Assistant

A full-stack app that analyzes article text and returns:
- short summary points
- key claims
- credibility signals
- fact-check items
- highlighted text spans

The frontend is a React + Vite app, and the backend is an Express API that uses a local text-generation model via `@xenova/transformers`.

## Project Structure

```text
InformationCredibilityAssistant/
  backend/   # Express API + local AI analysis
  frontend/  # React client (Vite)
```

## Requirements

- Node.js 18+ recommended
- npm

## Quick Start

### 1. Install dependencies

From the project root:

```powershell
cd InformationCredibilityAssistant
cd backend; npm install
cd ../frontend; npm install
```

### 2. Start backend

In one terminal:

```powershell
cd InformationCredibilityAssistant/backend
node server.js
```

Backend defaults to `http://localhost:5000`.

### 3. Start frontend

In a second terminal:

```powershell
cd InformationCredibilityAssistant/frontend
npm run dev
```

Frontend runs on Vite (typically `http://localhost:5173`).

The frontend proxies `/api/*` requests to `http://localhost:5000`.

## API

### Health Check

`GET /api/health`

Example:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

### Model Status

`GET /api/model`

Returns whether a local model is loaded and which model is currently in use.

### Analyze Text

`POST /api/analyze`

Request body:

```json
{
  "text": "Your article text here"
}
```

PowerShell example:

```powershell
$body = @{ text = "Sample article text..." } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/analyze" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
```

## Backend Model Notes

The backend attempts local model loading in this order:
1. `LOCAL_MODEL_ID` (if provided)
2. `Xenova/TinyLlama-1.1B-Chat-v1.0`
3. `Xenova/gpt2`

Optional environment variables:
- `PORT` (default: `5000`)
- `MAX_ANALYZE_CHARS` (default: `6000`)
- `LOCAL_MODEL_ID` (custom local model id)

## Scripts

### Backend (`backend/package.json`)
- `npm run start` -> start server with Node
- `npm run dev` -> start server with Nodemon

### Frontend (`frontend/package.json`)
- `npm run dev` -> start Vite dev server
- `npm run build` -> production build
- `npm run preview` -> preview production build
- `npm run lint` -> run ESLint

## Troubleshooting

- If frontend cannot reach backend:
  - confirm backend is running on port `5000`
  - verify Vite proxy config in `frontend/vite.config.js`

- If `/api/analyze` returns model-loading errors:
  - wait for backend startup to finish model initialization
  - check backend terminal logs for model download/load failures

- If `npm run dev` fails:
  - make sure the command is run inside `frontend/`
  - run `npm install` in that folder first
