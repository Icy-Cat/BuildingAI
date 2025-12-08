# @buildingai/api

## Project setup

```bash
pnpm install
```

## Compile and run the project

```bash
# development
pnpm run start

# watch mode
pnpm run start:dev

# production mode
pnpm run start:prod
```

## AI Schedule Schema Output Toggle

- The AI 日程助手 now enforces JSON Schema output for compatible models. This behaviour is controlled by the `schemaOutputEnabled` flag inside the `schedule_config` dictionary entry (group: `ai`).
- Operators can disable enforcement (fallback to prompt-only parsing) by setting `schemaOutputEnabled` to `false` via the admin console or directly through `DictService`.
- When enabled (default), providers that expose the `structured-output` feature will automatically receive the schema through `response_format`, and the API logs whether enforcement was applied or skipped for each parse request.
