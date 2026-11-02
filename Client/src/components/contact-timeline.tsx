'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useWorkspace } from '@/hooks/use-workspace';
import { canWrite } from '@/lib/modules';
import type { Entity } from '@/lib/types';
import { Button, Skeleton, ErrorState } from './ui';
const schema = z.object({ text: z.string().trim().min(1).max(5000) });
export function ContactTimeline({ id }: { id: string }) {
  const { orgId, user } = useWorkspace();
  const cache = useQueryClient();
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['org', orgId, 'contacts', id, 'activity'],
    queryFn: () => api.get<Entity[]>(`/contacts/${id}/activity`).then((r) => r.data),
    enabled: !!orgId,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <section className="panel dashboard-bottom">
      <div className="panel-heading">
        <h2>Notes & activity</h2>
        <p className="muted">Keep the context close to the relationship.</p>
      </div>
      <div className="panel-body">
        {user && canWrite(user.role, ['SALES']) && (
          <form
            className="stack"
            style={{ marginBottom: 24 }}
            onSubmit={handleSubmit(async (v) => {
              setError('');
              try {
                await api.post(`/contacts/${id}/notes`, v);
                reset();
                await cache.invalidateQueries({
                  queryKey: ['org', orgId, 'contacts', id, 'activity'],
                });
                toast.success('Note added');
              } catch (e) {
                setError(errorMessage(e));
              }
            })}
          >
            {error && (
              <p className="form-alert" role="alert">
                {error}
              </p>
            )}
            <label>
              <span className="sr-only">Add a note</span>
              <textarea
                required
                maxLength={5000}
                placeholder="A call, a meeting, a little useful context…"
                {...register('text')}
              />
            </label>
            <Button type="submit" busy={isSubmitting} style={{ justifySelf: 'end' }}>
              Add note
            </Button>
          </form>
        )}
        {query.isPending ? (
          <Skeleton rows={2} />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />
        ) : (
          query.data.map((e) => (
            <div className="activity-item" key={e.id}>
              <span className="activity-avatar">{e.user?.name[0] ?? 'S'}</span>
              <div>
                <p>
                  <strong>{e.user?.name ?? 'System'}</strong> {e.action}
                </p>
                {e.metaJson?.note && (
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{e.metaJson.note}</p>
                )}
                <time>
                  {e.createdAt
                    ? formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })
                    : ''}
                </time>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
