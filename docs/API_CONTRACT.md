# Echo App Center API Contract

Echo App Center talks to Echo App Server.

Required endpoints:

```text
GET  /health
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/auth/me
GET  /api/catalog
GET  /api/catalog/latest/:appId
GET  /api/admin/users/pending
POST /api/admin/users/:id/approve
POST /api/apps/admin/create
PATCH /api/apps/admin/:id
POST /api/apps/admin/:id/media
```

App Center must not decide admin permissions locally. It only displays admin UI after the server confirms permissions.
