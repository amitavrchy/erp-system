import { AuthForm } from '@/components/auth-form';
export default async function Invite({params}:{params:Promise<{token:string}>}){const {token}=await params;return <AuthForm mode="invite" token={token}/>;}
