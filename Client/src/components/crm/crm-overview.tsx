'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Plus,
  Target,
  Users,
  TrendingUp,
  Clock3,
  Headphones,
  CheckCircle2,
  ArrowRight,
  Download,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { api, money, errorMessage, date } from '@/lib/api';
import { canWrite } from '@/lib/modules';
import { humanize, type CrmSummary } from '@/lib/crm';
import { downloadCsv } from '@/lib/export';
import { Button, Badge, Skeleton, ErrorState, Empty } from '@/components/ui';

export function CrmOverview({ analytics = false }: { analytics?: boolean }) {
  const { orgId, org, user } = useWorkspace();
  const query = useQuery({
    queryKey: ['org', orgId, 'crm', 'summary'],
    queryFn: () => api.get<CrmSummary>('/crm/summary').then((r) => r.data),
    enabled: !!orgId,
  });
  if (query.isPending) return <Skeleton rows={7} />;
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />;
  const d = query.data;
  const openTickets = d.tickets
    .filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status))
    .reduce((n, t) => n + t._count, 0);
  const completedTasks = d.tasks.find((t) => t.status === 'COMPLETED')?._count ?? 0;
  const stats = [
    {
      label: 'Open pipeline',
      value: money(d.pipelineValue, org?.currency),
      detail: `${d.openDeals} active opportunities`,
      Icon: TrendingUp,
      tone: 'blue',
    },
    {
      label: 'New leads',
      value: String(d.newLeads),
      detail: `${d.leads} leads in your workspace`,
      Icon: Users,
      tone: 'violet',
    },
    {
      label: 'Win rate',
      value: `${d.winRate}%`,
      detail: `${money(d.wonValue, org?.currency)} in won deals`,
      Icon: Target,
      tone: 'green',
    },
    {
      label: 'Overdue follow-ups',
      value: String(d.overdueTasks),
      detail: 'A small nudge goes a long way',
      Icon: Clock3,
      tone: 'amber',
    },
  ];
  return (
    <>
      <div className="page-title spread">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {analytics ? 'CRM INTELLIGENCE' : 'RELATIONSHIPS, IN MOTION'}
          </div>
          <h1>
            {analytics ? 'Know what moves the needle.' : 'Turn conversations into customers.'}
          </h1>
          <p>
            {analytics
              ? 'Real pipeline, acquisition and service insights for your team.'
              : `Your sales, marketing and customer care, connected at ${org?.name}.`}
          </p>
        </div>
        <div className="row">
          {analytics ? (
            <Button
              onClick={() =>
                downloadCsv('crm-performance', [
                  { metric: 'Pipeline value', value: d.pipelineValue },
                  { metric: 'Weighted forecast', value: d.weightedValue },
                  { metric: 'Won deal value', value: d.wonValue },
                  { metric: 'Win rate (%)', value: d.winRate },
                  { metric: 'Leads', value: d.leads },
                  { metric: 'Converted leads', value: d.convertedLeads },
                  { metric: 'Overdue tasks', value: d.overdueTasks },
                ])
              }
            >
              <Download size={16} />
              Export insights
            </Button>
          ) : (
            user &&
            canWrite(user.role, ['SALES']) && (
              <Link className="button primary" href="/app/crm/leads?new=true">
                <Plus size={17} />
                Add lead
              </Link>
            )
          )}
        </div>
      </div>
      <div className="crm-stats">
        {stats.map(({ label, value, detail, Icon, tone }) => (
          <article className="panel crm-stat" key={label}>
            <div className="spread">
              <span className="muted">{label}</span>
              <span className={`crm-stat-icon ${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <div className="crm-stat-value mono">{value}</div>
            <p className="muted">{detail}</p>
          </article>
        ))}
      </div>
      <div className="crm-overview-grid">
        <section className="panel">
          <div className="panel-heading spread">
            <div>
              <h2>Pipeline health</h2>
              <p className="muted">Every stage tells part of the story.</p>
            </div>
            <Link href="/app/crm/deals" className="row link">
              Open pipeline <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="panel-body">
            <div className="spread" style={{ marginBottom: 24 }}>
              <div>
                <p className="muted">Weighted forecast</p>
                <div className="crm-forecast mono">{money(d.weightedValue, org?.currency)}</div>
              </div>
              <span className="badge">Probability × deal value</span>
            </div>
            {d.stages.length ? (
              <div className="crm-funnel">
                {d.stages
                  .filter((s) => s.outcome !== 'LOST')
                  .slice(0, 8)
                  .map((s, i) => (
                    <div className="crm-funnel-row" key={s.id}>
                      <span>{s.name}</span>
                      <div className="crm-progress">
                        <span
                          style={{
                            width: `${Math.max(0, (s._count!.deals / Math.max(...d.stages.map((s) => s._count?.deals ?? 0), 1)) * 100)}%`,
                            background:
                              i === d.stages.length - 2 ? 'var(--green)' : 'var(--accent)',
                          }}
                        />
                      </div>
                      <strong className="mono">{s._count?.deals ?? 0}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <Empty
                title="Build your first pipeline"
                description="Choose stages that fit the way your team sells."
                action={
                  <Link className="button" href="/app/crm/pipelines">
                    Set up pipeline
                  </Link>
                }
              />
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Your team’s next moves</h2>
            <p className="muted">The right action, at the right moment.</p>
          </div>
          <Link href="/app/crm/tasks?overdue=true" className="crm-next-action">
            <span className="crm-stat-icon amber">
              <Clock3 size={20} />
            </span>
            <div>
              <strong>{d.overdueTasks} overdue follow-ups</strong>
              <p className="muted">Bring the conversation back into focus.</p>
            </div>
            <ArrowRight size={17} />
          </Link>
          <Link href="/app/crm/tickets" className="crm-next-action">
            <span className="crm-stat-icon violet">
              <Headphones size={20} />
            </span>
            <div>
              <strong>{openTickets} open support tickets</strong>
              <p className="muted">Give every customer a clear next step.</p>
            </div>
            <ArrowRight size={17} />
          </Link>
          <Link href="/app/crm/campaigns" className="crm-next-action">
            <span className="crm-stat-icon green">
              <Target size={20} />
            </span>
            <div>
              <strong>{d.activeCampaigns} active campaigns</strong>
              <p className="muted">Keep your next growth initiative on track.</p>
            </div>
            <ArrowRight size={17} />
          </Link>
          <div className="panel-body row positive">
            <CheckCircle2 size={17} />
            {completedTasks} tasks completed · {d.completedActivities} activities logged in 30 days
          </div>
        </section>
      </div>
      <div className="crm-overview-grid dashboard-bottom">
        <section className="panel">
          <div className="panel-heading spread">
            <h2>Opportunities in motion</h2>
            <Link href="/app/crm/deals" className="link">
              View all
            </Link>
          </div>
          {d.recentDeals.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Opportunity</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Value</th>
                    <th scope="col">Expected close</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentDeals.map((deal) => (
                    <tr key={deal.id}>
                      <td>
                        <Link
                          href={`/app/crm/deals/${deal.id}`}
                          className="table-link cell-primary"
                        >
                          {deal.name}
                        </Link>
                        <span className="subtext mono">{deal.number}</span>
                      </td>
                      <td>
                        <Badge status={deal.stage?.outcome ?? 'OPEN'} />
                        <span className="subtext">{deal.stage?.name}</span>
                      </td>
                      <td className="mono">{money(deal.value, org?.currency)}</td>
                      <td>{date(deal.expectedClose)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Your next opportunity starts here"
              description="Create a deal or convert a qualified lead."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Where leads come from</h2>
            <p className="muted">Acquisition sources across your workspace.</p>
          </div>
          <div className="panel-body stack">
            {d.sources.length ? (
              d.sources
                .sort((a, b) => b.total - a.total)
                .map((s) => (
                  <div key={s.name}>
                    <div className="spread" style={{ marginBottom: 8 }}>
                      <span>{humanize(s.name)}</span>
                      <strong className="mono">{s.total}</strong>
                    </div>
                    <div className="crm-progress">
                      <span style={{ width: `${(s.total / Math.max(d.leads, 1)) * 100}%` }} />
                    </div>
                  </div>
                ))
            ) : (
              <p className="muted">Lead sources will appear as your pipeline grows.</p>
            )}
            <div className="crm-conversion-note">
              <p className="muted">Lead conversion</p>
              <strong className="mono">
                {d.leads ? Math.round((d.convertedLeads / d.leads) * 100) : 0}%
              </strong>
              <span className="muted">
                {d.convertedLeads} of {d.leads} leads converted
              </span>
            </div>
          </div>
        </section>
      </div>
      {analytics && (
        <div className="panel dashboard-bottom">
          <div className="panel-heading">
            <h2>Customer service health</h2>
            <p className="muted">
              Live queue counts, with no invented delivery or engagement metrics.
            </p>
          </div>
          <div className="panel-body crm-service-counts">
            {['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((status) => (
              <div key={status}>
                <p className="muted">{humanize(status)}</p>
                <strong className="mono">
                  {d.tickets.find((t) => t.status === status)?._count ?? 0}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
