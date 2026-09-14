# GLIMPSE Frontend

React frontend (served by nginx) for [GLIMPSE](https://github.com/pnnl/GLIMPSE),
a graph-based desktop application to visualize and update GridLAB-D power grid
models.

This image serves the GLIMPSE UI and talks to the `gridappsd/glimpse-backend`
image over its API/socket endpoint. Pair the two using the project's
[docker-compose.yml](https://github.com/pnnl/GLIMPSE/blob/main/docker-compose.yml).

## Quick start

```bash
git clone http://github.com/pnnl/GLIMPSE
cd GLIMPSE
docker compose up --build
```

Then open `http://localhost:5173`.

## Configuration

Key environment variables:

- `API_URL` - URL the browser uses to reach the backend (default `http://127.0.0.1:5052`)
- `API_TOKEN` - must match the backend's `GLIMPSE_API_TOKEN` (baked into `env.js` at container start)

See the [README](https://github.com/pnnl/GLIMPSE#readme) for full details.
