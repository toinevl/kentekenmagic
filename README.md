# KentekenMagic

Consumer-grade Dutch license plate lookup app powered by public RDW data.

## Workspace

- `frontend/` - Next.js static export app for Azure Static Web Apps
- `api/` - Azure Functions v4 TypeScript API
- `.planning/` - product plan, requirements, verification, and research

## Planned Commands

After dependencies are installed:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Notes

Runtime secrets belong in local environment files or Azure application settings. Do not commit RDW Socrata tokens, Azure Storage connection strings, or LLM provider keys.
