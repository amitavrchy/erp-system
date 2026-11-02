# Connected CRM suite

Open `/app/crm/overview`. The CRM covers sales, marketing planning and customer support inside the existing multi-tenant ERP workspace.

## Working features

| Area | Implemented behavior |
| --- | --- |
| Workspace overview | Pipeline value, probability-weighted forecast, won value, win rate, overdue follow-ups, acquisition sources and service counts from actual records |
| Leads | Search, lifecycle filters, source, manual score, owner, potential value, tags, notes, custom fields, pagination and CSV export |
| Lead conversion | Transactional contact creation/reuse, optional opportunity, linked activity history and repeat-safe conversion targets |
| Deal management | Multiple pipelines, configurable/reorderable stages, probabilities, open/won/lost outcomes, loss reasons, close dates, board/list views, drag-and-drop and keyboard-accessible stage selectors |
| ERP handoff | Create a linked quote from a deal once, then continue the existing quote → order → invoice → payment workflow |
| Contacts | Lifecycle, source, owner and tag filters; notes, custom fields, linked opportunities, follow-ups, conversations, support and financial documents |
| Tasks | Assignments, types, priority, due dates, overdue/mine filters and completion/reopening |
| Activities | Calls, meetings, email records and notes; scheduled/completed/cancelled states, outcomes and related records |
| Calendar | Month navigation, dated task/activity display, owner filters, daily agenda and inline scheduling/editing |
| Audience segments | Live contact audiences from combined lifecycle, source, tag and owner conditions |
| Campaign planning | Audience association, channel, lifecycle, budgets, actual spend, campaign dates, message drafts and CSV export |
| Support | Numbered tickets, assignments, priority, queue filters, deadlines, internal notes, recorded customer replies and mandatory resolutions |
| Automations | Enabled lead-created, deal-stage-changed and ticket-created rules create assigned follow-up tasks transactionally; execution count and last-run timestamp are visible |
| Custom fields | Admin-defined text, number, date and select fields for contacts/leads/deals, required-field validation and typed persistence |
| Import | CSV preview, 500-row limit, case-insensitive duplicate email skipping, custom-field columns, strict validation and atomic import |
| Global search | CRM leads, deals and tickets join existing customer, product and document search |
| UI | Minimum 14px text, responsive layouts, reduced-motion support and white primary-button text in light mode |

Pipeline stages holding deals cannot be deleted or change their open/won/lost outcome. Existing field keys, entity types and field types remain stable to preserve historical values. Select choices cannot be removed after definition. Business records use lifecycle changes instead of destructive deletion.

Ticket deadlines default to 4 hours for urgent, 24 for high, 48 for medium and 72 for low priority when no deadline is supplied. These are recorded deadlines, not a background notification or escalation service. Teams can set a specific deadline themselves.

## Roles and data safety

Owners and admins configure pipelines, custom fields and automation rules. Sales-role members manage CRM records. Viewers and Finance members can inspect CRM; Inventory members do not receive CRM access. Assignees must be CRM teammates in the same organization. All associated contacts, leads, deals, stages and segments are checked against the authenticated organization.

CRM writes include audit records. Lead conversion, stage changes, automation side effects, quote creation and imports use transactions; competing writes can return 409 for a safe retry. Analytics aggregate in the database under a consistent read snapshot. Opportunity forecasts are CRM estimates and are distinct from invoice revenue.

## Demo and setup

Apply migrations with `npm run db:migrate` from Server. For an existing demo organization, run `npm run seed:crm`. Run `npm run seed` first if the base demo does not exist. CRM seeding is atomic, refuses production, preserves existing records and skips when its seed marker already exists.

The seeded CRM includes 12 leads, staged opportunities, assigned tasks, calendar activities, dynamic audiences, campaign plans, support tickets, custom fields and functioning task automations. Base ERP money and stock are preserved.

CSV headers are `name`, optional `email` and `phone`, plus `custom_<field_key>` for defined contact custom fields. Required custom fields need values in every new row. The import skips existing emails rather than overwriting customer records.

## Integration boundaries

Campaigns are planning workspaces. Activity email records and ticket customer replies log work inside Ledgerflow; they do not deliver messages. No email/SMS provider, telephony, social inbox, external calendar or website chat provider has been connected. Consequently there are no fabricated sent/open/click statistics or provider credentials.

The current automation action creates tasks in response to supported CRM mutations. Arbitrary workflow scripting, scheduled sequences, external webhooks, marketing consent management, advanced SLA escalation and AI scoring are not claimed as implemented. Lead scores are entered by the team. This is a substantial CRM suite expansion, not a claim to contain every CRM feature in existence.

## Verification

`npm run test:integration` runs both ERP and CRM API acceptance suites against real Postgres. `npm run test:e2e` in Client runs the ERP and CRM browser scenarios. The CRM scenario creates pipelines, required fields and rules, converts a lead, moves a deal, creates a quote, completes a generated task, schedules an activity, defines an audience/campaign, resolves a ticket, imports contacts and checks light-mode button text and mobile layout. Browser fixtures are removed afterward.
