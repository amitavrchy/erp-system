'use client';
import { useState } from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Clock3, CheckCircle2, CalendarDays } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useCrmList, useCrmMeta } from '@/hooks/use-crm';
import { canWrite } from '@/lib/modules';
import { humanize, type CrmKind, type CrmRow } from '@/lib/crm';
import { errorMessage } from '@/lib/api';
import { Button, Badge, Empty, Skeleton, ErrorState } from '@/components/ui';
import { CrmDialog } from './crm-form';
import Link from 'next/link';

export function CrmCalendar() {
  const { user } = useWorkspace();
  const meta = useCrmMeta();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [owner, setOwner] = useState('');
  const [create, setCreate] = useState<CrmKind>();
  const [edit, setEdit] = useState<{ kind: CrmKind; row: CrmRow }>();
  const allowed = user && canWrite(user.role, ['SALES']);
  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  const params = {
    pageSize: 100,
    from: start.toISOString(),
    to: end.toISOString(),
    ...(owner ? { ownerId: owner } : {}),
  };
  const activities = useCrmList('activities', params);
  const tasks = useCrmList('tasks', params);
  const items = [
    ...(activities.data?.data ?? []).map((r) => ({
      ...r,
      date: r.startsAt!,
      kind: 'activities' as CrmKind,
    })),
    ...(tasks.data?.data ?? [])
      .filter((r) => r.dueAt)
      .map((r) => ({ ...r, date: r.dueAt!, kind: 'tasks' as CrmKind })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const dayItems = items.filter((r) => isSameDay(new Date(r.date), selected));
  return (
    <>
      <div className="page-title spread">
        <div>
          <h1>A little room for the next conversation.</h1>
          <p>Meetings, calls and follow-ups, together on your calendar.</p>
        </div>
        <div className="row">
          <Link href="/app/crm/activities" className="button">
            Activity log
          </Link>
          {allowed && (
            <Button variant="primary" onClick={() => setCreate('activities')}>
              <Plus size={17} />
              Schedule activity
            </Button>
          )}
        </div>
      </div>
      <div className="crm-calendar-layout">
        <section className="panel">
          <div className="toolbar">
            <div className="row">
              <Button aria-label="Previous month" onClick={() => setMonth(subMonths(month, 1))}>
                <ChevronLeft size={17} />
              </Button>
              <h2>{format(month, 'MMMM yyyy')}</h2>
              <Button aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight size={17} />
              </Button>
            </div>
            <div className="row">
              <Button
                onClick={() => {
                  setMonth(new Date());
                  setSelected(new Date());
                }}
              >
                Today
              </Button>
              <select
                aria-label="Calendar owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="">All owners</option>
                <option value="me">My activities</option>
                {meta.data?.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {activities.isPending || tasks.isPending ? (
            <Skeleton />
          ) : activities.isError || tasks.isError ? (
            <ErrorState
              message={errorMessage(activities.error ?? tasks.error)}
              retry={() => {
                activities.refetch();
                tasks.refetch();
              }}
            />
          ) : (
            <div className="crm-calendar-scroll">
              <div className="crm-calendar-weekdays">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="crm-calendar-grid">
                {eachDayOfInterval({ start, end }).map((day) => {
                  const events = items.filter((r) => isSameDay(new Date(r.date), day));
                  return (
                    <button
                      key={day.toISOString()}
                      className={`crm-calendar-day ${!isSameMonth(day, month) ? 'outside' : ''} ${isSameDay(day, selected) ? 'selected' : ''}`}
                      onClick={() => setSelected(day)}
                      aria-label={format(day, 'MMMM d, yyyy')}
                    >
                      <span className={isSameDay(day, new Date()) ? 'today' : ''}>
                        {format(day, 'd')}
                      </span>
                      <div>
                        {events.slice(0, 2).map((item) => (
                          <span
                            className={`crm-calendar-event ${item.kind === 'tasks' ? 'task' : ''}`}
                            key={item.id}
                          >
                            {item.kind === 'activities' ? (
                              <Clock3 size={12} />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            <span>{item.name}</span>
                          </span>
                        ))}
                        {events.length > 2 && (
                          <span className="muted">+{events.length - 2} more</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="panel-body muted">
            Showing up to 100 activities and 100 dated tasks in this month. Use the activity log for
            full search and pagination.
          </div>
        </section>
        <aside className="panel">
          <div className="panel-heading spread">
            <div>
              <p className="eyebrow">YOUR AGENDA</p>
              <h2>{format(selected, 'EEEE, MMM d')}</h2>
            </div>
            <CalendarDays size={20} className="muted" />
          </div>
          <div className="panel-body">
            {dayItems.length ? (
              <div className="stack">
                {dayItems.map((item) => (
                  <button
                    key={item.id}
                    className="crm-agenda-card"
                    disabled={!allowed}
                    onClick={() => setEdit({ kind: item.kind, row: item })}
                  >
                    <div className="spread">
                      <span className="muted">{format(new Date(item.date), 'h:mm a')}</span>
                      <Badge status={item.status} />
                    </div>
                    <h3>{item.name}</h3>
                    <p className="muted">
                      {humanize(item.type)}
                      {item.contact?.name ? ` · ${item.contact.name}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="A little breathing room"
                description="No activities or dated tasks for this day."
              />
            )}
            {allowed && (
              <Button style={{ width: '100%', marginTop: 18 }} onClick={() => setCreate('tasks')}>
                <Plus size={16} />
                Add follow-up
              </Button>
            )}
          </div>
        </aside>
      </div>
      {create && (
        <CrmDialog
          kind={create}
          close={() => setCreate(undefined)}
          defaults={{
            startsAt: format(selected, "yyyy-MM-dd'T'09:00"),
            dueAt: format(selected, "yyyy-MM-dd'T'09:00"),
          }}
        />
      )}
      {edit && <CrmDialog kind={edit.kind} row={edit.row} close={() => setEdit(undefined)} />}
    </>
  );
}
