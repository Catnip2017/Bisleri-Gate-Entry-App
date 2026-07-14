# legacy_sql — archived, do not run

These hand-written `.sql` files predate the Alembic adoption. **All of them have
already been applied to `Bisleri_dev`** — their effects are baked into the current
25-table schema. They are kept purely as an audit trail of how the schema evolved.

**Do NOT re-run these.** Running them on a fresh DB would error (table already
exists) or double-apply. Schema changes from here on go through Alembic
(`migrations/versions/`). See `DB_Schema_Alembic_Migration_Plan.pdf` for the plan.

`schema.sql` here is the old stale 8-table schema — superseded by
`DB Schemas/schema_bisleri_01.sql`.

`role_redesign_migration.sql` — role model redesign (14 Jul 2026): 'Gate Pass
User' split into Creator/Dispatcher, 'Security Admin' removed. Data-only,
idempotent-safe but already RUN on Bisleri_dev — archived like the rest.
