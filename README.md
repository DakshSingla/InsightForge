# InsightForge

InsightForge is a sales intelligence web app. A user uploads one or two sales datasets, selects a reporting style, and receives a styled AI-generated report by email.

## What It Does

- Upload `.csv` or `.xlsx` sales data
- Run backend analytics before AI generation
- Detect revenue trends, region dominance, product momentum, anomalies, and data quality warnings
- Support optional comparison mode between two datasets
- Generate a detailed AI narrative using Gemini
- Send the report through a styled email template
- Show dataset preview, confidence score, and quality notes in the UI

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- AI: Google Gemini API
- Email: Nodemailer
- Deployment: Vercel (frontend), Render (backend)
- DevOps: Docker, Docker Compose, GitHub Actions

## Project Structure

```text
InsightForge
|- backend
|  |- ai.js
|  |- analytics.js
|  |- audit.js
|  |- email.js
|  |- server.js
|  |- package.json
|  `- Dockerfile
|- frontend
|  |- src
|  |- package.json
|  `- vercel.json
|- .github/workflows/pull-request.yml
|- docker-compose.yml
|- render.yaml
|- sample-sales-q1.csv
|- sample-sales-q2.csv
`- .env.example
```

## Environment Variables

Create `.env` in the repo root:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="InsightForge <your_email@gmail.com>"
```

Frontend uses:

```env
VITE_API_BASE_URL=http://localhost:5000
```

On Vercel, set `VITE_API_BASE_URL` in project environment variables.

## Run Locally

### Manual

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- API docs: `http://localhost:5000/api-docs`

### Docker

```powershell
docker compose up --build
```

## User Flow

1. Enter email
2. Upload primary sales file
3. Optionally upload comparison file
4. Choose summary style
5. Toggle explain-insights mode
6. Review dataset preview
7. Click generate
8. Receive a styled email report

## API Endpoints

- `GET /health`
- `GET /summary-styles`
- `POST /preview`
- `POST /upload`

Swagger UI is available at `/api-docs`.

## Deployment

### Frontend on Vercel

Deploy the `frontend` directory.

Required setting:

- `VITE_API_BASE_URL=https://your-render-backend.onrender.com`

### Backend on Render

Deploy the `backend` directory as a Node web service.

Recommended settings:

- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: `backend`

Set these environment variables on Render:

- `PORT`
- `FRONTEND_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## CI

GitHub Actions runs on pull requests and checks:

- backend syntax
- backend lint
- frontend build
- frontend lint

## Sample Files

Use these for demo/testing:

- `sample-sales-q1.csv`
- `sample-sales-q2.csv`

Recommended comparison demo:

- Primary: `sample-sales-q2.csv`
- Comparison: `sample-sales-q1.csv`

## Notes

- The backend reads the first worksheet from uploaded workbooks.
- Prompt audit entries are written to `backend/prompt-audit.log` locally and ignored by git.
- Do not commit real `.env` secrets.
