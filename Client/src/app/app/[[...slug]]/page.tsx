import { Dashboard } from '@/components/dashboard';
import { ListPage } from '@/components/list-page';
import { DocumentDetail } from '@/components/document-detail';
import { Settings } from '@/components/settings';
import { Reports,Accounts } from '@/components/reports';
import { MasterDetail } from '@/components/master-detail';
import { notFound } from 'next/navigation';

export const instant = false;
const routes:Record<string,string>={'crm/contacts':'contacts','crm/companies':'companies','sales/quotes':'quotes','sales/orders':'orders','inventory/products':'products','inventory/warehouses':'warehouses','inventory/movements':'movements','inventory/adjustments':'adjustments','purchasing/vendors':'vendors','purchasing/pos':'pos','finance/invoices':'invoices','finance/bills':'bills','finance/payments':'payments'};
export default async function Workspace({params}:{params:Promise<{slug?:string[]}>}){const {slug=[]}=await params;if(!slug.length)return <Dashboard/>;if(slug.join('/')==='settings')return <Settings/>;if(slug.join('/')==='reports')return <Reports/>;if(slug.join('/')==='finance/accounts')return <Accounts/>;const key=routes[slug.slice(0,2).join('/')];if(!key||slug.length>3)notFound();if(slug.length===3){if(['quotes','orders','invoices','pos'].includes(key))return <DocumentDetail moduleKey={key} id={slug[2]}/>;if(['contacts','products'].includes(key))return <MasterDetail moduleKey={key} id={slug[2]}/>;notFound();}return <ListPage moduleKey={key}/>;}
