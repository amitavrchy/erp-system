# Ledgerflow build

The implementation follows docs/PROJECT_SPEC.md. The explicit user requirement overrides
the spec's dense typography: all text is at least 14px.

## Milestones

- [x] Database schema, migrations and secure authentication
- [ ] Tenant-scoped CRM and catalog, roles and audit
- [ ] Transactional sales, payments and stock workflows
- [ ] Responsive application shell and accessible design system
- [ ] Connected module screens, forms and document details
- [ ] Dashboard, reports, demo seed and settings
- [ ] Integration tests, browser verification and deployment documentation

Stretch features in the spec are separate from the MVP. Production deployment
requires operator-provided secrets, HTTPS, backups and an appropriate hosting target.
