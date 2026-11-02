'use client';
import { CrmNav } from './crm-nav';
import { CrmOverview } from './crm-overview';
import { CrmList } from './crm-list';
import { CrmDetail } from './crm-detail';
import { CrmCalendar } from './crm-calendar';
import { CrmPipelines, CrmImport } from './crm-settings';
import { crmKinds, type CrmKind } from '@/lib/crm';

export const crmViews = ['overview', 'analytics', 'calendar', 'pipelines', 'import', ...crmKinds];
export function CrmWorkspace({ section, id }: { section: string; id?: string }) {
  return (
    <>
      <CrmNav />
      {id ? (
        <CrmDetail kind={section as CrmKind} id={id} />
      ) : section === 'overview' || section === 'analytics' ? (
        <CrmOverview analytics={section === 'analytics'} />
      ) : section === 'calendar' ? (
        <CrmCalendar />
      ) : section === 'pipelines' ? (
        <CrmPipelines />
      ) : section === 'import' ? (
        <CrmImport />
      ) : (
        <CrmList kind={section as CrmKind} />
      )}
    </>
  );
}
