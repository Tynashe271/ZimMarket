'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Dashboard } from '../../src/Dashboard';
import { savedSession } from '../../src/api';

export function AdminGate() {
  const [authorized,setAuthorized]=useState(false);
  useEffect(()=>{
    const session=savedSession();
    if(!session||session.user.accountType!=='ADMIN') { window.location.replace('/login/admin'); return; }
    setAuthorized(true);
  },[]);
  if(!authorized)return <main className="dashboard-loader"><LoaderCircle className="spin"/><span>Checking administrator access…</span></main>;
  return <Dashboard/>;
}
