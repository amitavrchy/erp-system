# Ledgerflow build

The implementation follows docs/PROJECT_SPEC.md. The explicit user requirement overrides
the spec's dense typography: all text is at least 14px.

## Milestones

- [x] Database schema, migrations and secure authentication
- [x] Tenant-scoped CRM and catalog, roles and audit
- [x] Transactional sales, payments and stock workflows
- [x] Responsive application shell and accessible design system
- [x] Connected module screens, forms and document details
- [x] Dashboard, reports, demo seed and settings
- [x] Integration tests, browser verification and deployment documentation

Stretch features in the spec are separate from the MVP. Production deployment
requires operator-provided secrets, HTTPS, backups and an appropriate hosting target.

All implementation milestones are complete. See docs/VERIFICATION.md for evidence and docs/DEPLOYMENT.md for operating requirements. No live production deployment was performed.

## CRM expansion

- [x] White primary-button text in light mode
- [x] Leads, conversion, multiple deal pipelines and quote handoff
- [x] Assigned tasks, activities and calendar
- [x] Segments and campaign planning
- [x] Support tickets, notes and resolution workflow
- [x] Custom fields, event-based task automation and CSV import
- [x] CRM analytics, tenant checks, audit history and regression coverage

See docs/CRM_SUITE.md for the feature matrix and external integration boundaries.
