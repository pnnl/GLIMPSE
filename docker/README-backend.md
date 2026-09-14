# GLIMPSE Backend

Flask + SocketIO backend for [GLIMPSE](https://github.com/pnnl/GLIMPSE), a
graph-based desktop application to visualize and update GridLAB-D power grid
models.

This image serves the GLIMPSE API and connects to a GridAPPS-D broker and a
Blazegraph SPARQL endpoint for CIM model loads. Pair it with the
`gridappsd/glimpse-frontend` image using the project's
[docker-compose.yml](https://github.com/pnnl/GLIMPSE/blob/main/docker-compose.yml).

## Quick start

```bash
git clone http://github.com/pnnl/GLIMPSE
cd GLIMPSE
docker compose up --build
```

## Configuration

Key environment variables:

- `FLASK_HOST` / `FLASK_PORT` - bind address and port (default `0.0.0.0:5052`)
- `CORS_ORIGINS` - comma-separated allowed browser origins
- `GLIMPSE_API_TOKEN` - shared bearer token for API/socket auth
- `GRIDAPPSD_ADDRESS`, `GRIDAPPSD_PORT`, `GRIDAPPSD_USER`, `GRIDAPPSD_PASSWORD` - GridAPPS-D broker connection
- `CIMG_URL` - Blazegraph SPARQL endpoint (derived from `GRIDAPPSD_ADDRESS` if unset)

See the [README](https://github.com/pnnl/GLIMPSE#readme) for full details.
