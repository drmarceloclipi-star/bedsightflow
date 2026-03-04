import{j as e,b as J,u as X}from"./index-u7YQAPVq.js";import{g as K,b as o,u as Y,d as Z}from"./vendor-react-DqENHa3F.js";import{B as ee}from"./BedsRepository-DExzhGho.js";import{B as ae}from"./BoardSettingsRepository-Bw0toOfM.js";import{U as te}from"./UnitsRepository-Cks7bOev.js";import{D as C,c as L,U as se}from"./UnitSettingsRepository-nzYgx5Z0.js";import{S as ne,D as ie}from"./types-B9Nn43mB.js";import{g as re,a as le,K as O,b as oe}from"./specialtyUtils-zq2H5jGy.js";import{r as de,a as ce}from"./kamishibaiVisualState-CjR3-UKV.js";import{g as me,H as z}from"./HuddleRepository-BDZfZhJK.js";import{c as he,D as ue}from"./escalation-BgvXCm7V.js";import{S as pe}from"./shield-alert-CqCEP-cs.js";import{S as xe}from"./smartphone--Jown20L.js";import{c as U}from"./createLucideIcon-BJXO5Ajm.js";import"./vendor-firebase-ph30_qBm.js";import"./simulatorMockData-DmPBmFZx.js";import"./functionNames-BiqPqyAu.js";const be=[["path",{d:"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4",key:"1slcih"}]],fe=U("flame",be);const ge=[["path",{d:"M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344",key:"2acyp4"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],H=U("square-check-big",ge);function ve(a){if(!a)return null;if(typeof a=="string"){const t=Date.parse(a);return isNaN(t)?null:t}return a instanceof Date?a.getTime():typeof a.toDate=="function"?a.toDate().getTime():null}function $(a,t=new Date){if(!a.patientAlias||a.patientAlias.trim()==="")return{open:0,overdue:0};const s=Array.isArray(a.pendencies)?a.pendencies:[],i=t.getTime();let h=0,l=0;for(const u of s)if(u.status==="open"&&(h++,u.dueAt)){const b=ve(u.dueAt);b!==null&&b<i&&l++}return{open:h,overdue:l}}function je(a,t=new Date){let s=0,i=0;for(const h of a){const l=$(h,t);s+=l.open,i+=l.overdue}return{open:s,overdue:i}}function R(a){return a.open===0?"":a.overdue===0?String(a.open):`${a.open} ⚠${a.overdue}`}const ye=a=>{switch(a){case"24h":return"state-success-bg";case"2-3_days":return"state-warning-bg";case">3_days":return"state-danger-bg";default:return"kanban-badge-indefinida"}},_=K.memo(({bed:a,now:t})=>{const s=o.useMemo(()=>$(a,t),[a,t]),i=R(s);return i?e.jsx("span",{className:`tv-badge tv-badge--pendencies${s.overdue>0?" tv-badge--overdue":""}`,"data-pendencies-open":s.open,"data-pendencies-overdue":s.overdue,"aria-label":s.overdue>0?`Pendências abertas: ${s.open}. Pendências vencidas: ${s.overdue}`:`Pendências abertas: ${s.open}`,title:`${s.open} pendência(s) aberta(s)${s.overdue>0?`, ${s.overdue} vencida(s)`:""}`,children:i}):null});_.displayName="PendencyBadge";const ke=({beds:a,columns:t=1,now:s=new Date})=>{const i=[...a].sort((g,p)=>g.number.localeCompare(p.number,void 0,{numeric:!0,sensitivity:"base"})),h=g=>e.jsxs("table",{className:"kanban-compact-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{style:{width:"10%"},children:"Leito"}),e.jsx("th",{style:{width:"16%"},children:"Paciente"}),e.jsx("th",{style:{width:"18%"},children:"Especialidades"}),e.jsx("th",{style:{width:"18%"},children:"Previsão Alta"}),e.jsx("th",{style:{width:"34%"},children:"Bloqueador Principal"}),e.jsx("th",{style:{width:"4%"},"aria-label":"Pendências"})]})}),e.jsx("tbody",{children:g.map(p=>{const x=re(p.involvedSpecialties||[]);return e.jsxs("tr",{children:[e.jsx("td",{children:e.jsx("span",{className:"kanban-bed-num",children:p.number})}),e.jsx("td",{children:e.jsx("span",{className:"kanban-patient",children:p.patientAlias||"—"})}),e.jsx("td",{children:e.jsx("div",{className:"kanban-chips",children:x.length>0?x.map(k=>e.jsx("span",{className:"specialty-chip-mini",title:ne[k],children:le(k)},k)):e.jsx("span",{style:{color:"var(--text-muted)",fontSize:"0.75rem"},children:"—"})})}),e.jsx("td",{children:e.jsx("span",{className:`kanban-badge ${ye(p.expectedDischarge)}`,children:ie[p.expectedDischarge]})}),e.jsx("td",{children:e.jsx("span",{className:"kanban-blocker",title:p.mainBlocker,children:p.mainBlocker||e.jsx("span",{style:{opacity:.3},children:"Nenhum"})})}),e.jsx("td",{className:"kanban-pendency-cell",children:e.jsx(_,{bed:p,now:s})})]},p.id)})})]}),l=t>1&&i.length>0,u=l?Math.ceil(i.length/2):i.length,b=l?i.slice(0,u):i,c=l?i.slice(u):[];return e.jsxs("div",{className:"animate-slideIn h-full flex flex-col",style:{padding:"0.5rem 1.25rem 1rem"},children:[e.jsx("h2",{className:"kanban-title",children:"Quadro Kanban — Fluxo de Alta"}),e.jsxs("div",{className:"kanban-table-wrapper",style:{display:"grid",gridTemplateColumns:l?"minmax(0, 1fr) minmax(0, 1fr)":"1fr",gap:"2rem"},children:[e.jsx("div",{className:"kanban-table-inner-wrapper",children:h(b)}),l&&e.jsx("div",{className:"kanban-table-inner-wrapper",children:h(c)})]}),e.jsx("style",{children:`
                .kanban-title {
                    font-size: 1.4rem;
                    font-family: var(--font-serif);
                    color: var(--text-secondary);
                    margin-bottom: 0.75rem;
                    flex-shrink: 0;
                }

                .kanban-table-wrapper {
                    flex: 1;
                    overflow: auto;
                    min-height: 0;
                }

                .kanban-table-inner-wrapper {
                    min-width: 0;
                    overflow: auto;
                }

                .kanban-compact-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }

                .kanban-compact-table thead th {
                    text-align: left;
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--text-muted);
                    padding: 0.4rem 0.6rem;
                    border-bottom: 2px solid var(--border-soft);
                    white-space: nowrap;
                }

                .kanban-compact-table tbody td {
                    padding: 0.35rem 0.6rem;
                    border-bottom: 1px solid var(--border-soft);
                    vertical-align: middle;
                    overflow: hidden;
                }

                .kanban-compact-table tbody tr:last-child td {
                    border-bottom: none;
                }

                .kanban-compact-table tbody tr:hover td {
                    background-color: var(--bg-surface-2);
                }

                .kanban-bed-num {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    white-space: nowrap;
                }

                .kanban-patient {
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .kanban-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    font-weight: 600;
                    padding: 0.15rem 0.5rem;
                    border-radius: 99px;
                    border: 1px solid currentColor;
                    white-space: nowrap;
                }

                .kanban-badge-indefinida {
                    color: var(--text-muted);
                    border-color: var(--border-soft);
                    border-style: dashed;
                }

                .kanban-blocker {
                    font-size: 0.82rem;
                    color: var(--text-secondary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: block;
                }

                .kanban-chips {
                    display: flex;
                    flex-wrap: nowrap;
                    gap: 0.2rem;
                    overflow: hidden;
                }

                .kanban-pendency-cell {
                    text-align: right;
                    white-space: nowrap;
                    min-width: 48px;
                }
            `})]})},q=K.memo(({bed:a,now:t})=>{const s=o.useMemo(()=>$(a,t),[a,t]),i=R(s);return i?e.jsx("span",{className:`tv-badge tv-badge--pendencies${s.overdue>0?" tv-badge--overdue":""}`,"data-pendencies-open":s.open,"data-pendencies-overdue":s.overdue,"aria-label":s.overdue>0?`Pendências abertas: ${s.open}. Pendências vencidas: ${s.overdue}`:`Pendências abertas: ${s.open}`,title:`${s.open} pendência(s) aberta(s)${s.overdue>0?`, ${s.overdue} vencida(s)`:""}`,children:i}):null});q.displayName="PendencyBadge";const Ne=({beds:a,columns:t=1,opsSettings:s,now:i=new Date})=>{const h=o.useMemo(()=>{const k=s?.huddleSchedule??C;return L(k)},[s?.huddleSchedule]),u={kamishibaiEnabled:s?.kamishibaiEnabled??!0,resolvedCurrentShiftKey:h,schedule:s?.huddleSchedule??C},b=k=>e.jsxs("table",{className:"kamishibai-compact-table bg-surface-1 rounded-lg shadow-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{style:{width:"80px"},children:"Leito"}),O.map(y=>e.jsx("th",{className:"text-center",children:oe(y)},y))]})}),e.jsx("tbody",{children:k.map(y=>e.jsxs("tr",{children:[e.jsxs("td",{children:[e.jsx("span",{className:"kamishibai-bed-num",children:y.number}),e.jsx(q,{bed:y,now:i})]}),O.map(m=>{const n=de(y,m,u),N=ce(n),r=n==="OK"||n==="BLOCKED"||n==="NOT_APPLICABLE",v=n==="UNREVIEWED_THIS_SHIFT"?"unreviewed":n.toLowerCase();return e.jsx("td",{className:"text-center","data-state":v,"data-domain":m,children:r?e.jsx("div",{className:`kamishibai-dot ${N}`,role:"img","aria-label":n==="OK"?"OK — revisado neste turno":n==="BLOCKED"?"Impedido":"Não aplicável"}):e.jsx("div",{className:"kamishibai-dot kamishibai-empty",role:"img","aria-label":n==="INACTIVE"?"Leito vazio ou Kamishibai inativo":"Não revisado neste turno"})},m)})]},y.id))})]}),c=t>1&&a.length>0,g=c?Math.ceil(a.length/2):a.length,p=c?a.slice(0,g):a,x=c?a.slice(g):[];return e.jsxs("div",{className:"kamishibai-container animate-slideIn h-full flex flex-col",children:[e.jsxs("div",{className:"kamishibai-header flex justify-between items-end p-6 pb-0 flex-shrink-0",children:[e.jsx("h2",{className:"kamishibai-title text-3xl font-serif",children:"Quadro Kamishibai — Pendências por Domínio / Equipe"}),e.jsxs("div",{className:"kamishibai-legend flex gap-4 text-xs font-bold uppercase tracking-widest text-secondary",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"kamishibai-dot kamishibai-dot--ok",style:{width:"16px",height:"16px",margin:0}}),e.jsx("span",{children:"OK / Concluído"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"kamishibai-dot kamishibai-dot--blocked",style:{width:"16px",height:"16px",margin:0}}),e.jsx("span",{children:"Impedido"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"kamishibai-dot kamishibai-placeholder--na",style:{width:"16px",height:"16px",margin:0}}),e.jsx("span",{children:"N/A"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"kamishibai-dot kamishibai-empty",style:{width:"16px",height:"16px",margin:0,border:"1px solid var(--border-soft)"}}),e.jsx("span",{children:"Sem cor (não revisado)"})]})]})]}),e.jsx("div",{className:"kamishibai-main p-4 pt-1 flex-1 overflow-hidden",children:e.jsxs("div",{className:"kamishibai-grid",style:{display:"grid",gridTemplateColumns:c?"minmax(0, 1fr) minmax(0, 1fr)":"1fr",gap:"2rem",height:"100%"},children:[e.jsx("div",{className:"kamishibai-table-wrapper",children:b(p)}),c&&e.jsx("div",{className:"kamishibai-table-wrapper",children:b(x)})]})}),e.jsx("style",{children:`
                .kamishibai-container {
                    /* anterior: zoom: 0.8 — não semântico e quebra em Firefox/Safari */
                    /* solução: reduzir font-size do container; filhos com 'em' herdam */
                    font-size: 80%;
                }

                .kamishibai-table-wrapper {
                    min-width: 0;
                    overflow: auto;
                }

                .kamishibai-compact-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }

                .kamishibai-compact-table thead th {
                    text-align: left;
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--text-muted);
                    padding: 0.4rem 0.6rem;
                    border-bottom: 2px solid var(--border-soft);
                    white-space: nowrap;
                }

                .kamishibai-compact-table thead th.text-center {
                    text-align: center;
                }

                .kamishibai-compact-table tbody td {
                    padding: 0.35rem 0.6rem;
                    border-bottom: 1px solid var(--border-soft);
                    vertical-align: middle;
                    overflow: hidden;
                }

                .kamishibai-compact-table tbody tr:last-child td {
                    border-bottom: none;
                }

                .kamishibai-compact-table tbody tr:hover td {
                    background-color: var(--bg-surface-2);
                }

                .kamishibai-bed-num {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    white-space: nowrap;
                    margin-right: 0.3rem;
                }
            `})]})},we=({metrics:a,unitName:t})=>e.jsxs("div",{className:"animate-slideIn flex flex-col items-center justify-center p-12 h-full",children:[e.jsxs("h2",{className:"text-4xl font-serif mb-12",children:["Resumo Executivo — ",t||"Unidade"]}),e.jsxs("div",{className:"grid-summary w-full max-w-5xl",children:[e.jsxs("div",{className:"summary-card",children:[e.jsx("span",{className:"summary-label",children:"Pacientes Ativos"}),e.jsx("span",{className:"summary-value",children:a.activePatients})]}),e.jsxs("div",{className:"summary-card highlight-success",children:[e.jsx("span",{className:"summary-label",children:"Altas Previstas (24h)"}),e.jsx("span",{className:"summary-value",children:a.discharges24h})]}),e.jsxs("div",{className:"summary-card highlight-danger",children:[e.jsx("span",{className:"summary-label",children:"Leitos com Bloqueio"}),e.jsx("span",{className:"summary-value",children:a.withBlockers})]}),a.pendenciesOpen>0&&e.jsxs("div",{className:`summary-card ${a.pendenciesOverdue>0?"highlight-danger":"highlight-warning"}`,children:[e.jsx("span",{className:"summary-label",children:"Pendências Abertas"}),e.jsx("span",{className:"summary-value","data-pendencies-open":a.pendenciesOpen,children:a.pendenciesOpen})]}),a.pendenciesOverdue>0&&e.jsxs("div",{className:"summary-card highlight-danger",children:[e.jsx("span",{className:"summary-label",children:"Pendências Vencidas ⚠"}),e.jsx("span",{className:"summary-value","data-pendencies-overdue":a.pendenciesOverdue,children:a.pendenciesOverdue})]})]}),e.jsx("div",{className:"mt-16 text-muted text-lg font-serif italic",children:'"Foco na fluidez, segurança e alta qualificada."'})]}),Se={calculateMetrics(a,t=new Date){const s=a.filter(c=>c.patientAlias&&c.patientAlias.trim()!==""),i=s.length,h=s.filter(c=>c.mainBlocker&&c.mainBlocker.trim()!=="").length,l=s.filter(c=>c.expectedDischarge==="24h").length,{open:u,overdue:b}=je(a,t);return{activePatients:i,discharges24h:l,withBlockers:h,pendenciesOpen:u,pendenciesOverdue:b}}},Pe=({beds:a,settings:t,unitName:s,opsSettings:i,now:h=new Date,forceScreen:l})=>{const[u,b]=o.useState(0),[c,g]=o.useState(0),p=(n,N)=>{const r=[];for(let v=0;v<n.length;v+=N)r.push(n.slice(v,v+N));return r},x=o.useMemo(()=>{const n=[];return t.screens.filter(r=>l?r.key===l:r.enabled).forEach(r=>{if(r.key==="kanban"||r.key==="kamishibai"){const v=r.key==="kanban"?t.kanbanBedsPerPage:t.kamishibaiBedsPerPage,d=p(a,v||18),w=r.key==="kanban"?t.kanbanColumnsPerPage??1:t.kamishibaiColumnsPerPage??1;d.forEach((D,M)=>{n.push({key:r.key,label:`${r.label} ${d.length>1?`(${M+1}/${d.length})`:""}`,duration:r.durationSeconds,beds:D,columns:w})})}else r.key==="summary"&&n.push({key:r.key,label:r.label,duration:r.durationSeconds})}),n},[t.screens,t.kanbanBedsPerPage,t.kamishibaiBedsPerPage,t.kanbanColumnsPerPage,t.kamishibaiColumnsPerPage,a,l]),k=o.useMemo(()=>Se.calculateMetrics(a,h),[a,h]),y=u>=x.length?0:u,m=x[y];return o.useEffect(()=>{if(!t.rotationEnabled||x.length<=1)return;const n=(m?.duration||10)*1e3,N=Date.now(),r=setInterval(()=>{const v=Date.now()-N,d=Math.min(v/n*100,100);g(d),d>=100&&(b(w=>((w>=x.length?0:w)+1)%x.length),g(0),clearInterval(r))},100);return()=>clearInterval(r)},[u,x,t.rotationEnabled,m]),m?e.jsxs("div",{className:"h-full flex flex-col relative",children:[e.jsxs("div",{className:"flex-1 overflow-hidden",children:[m.key==="kanban"&&e.jsx(ke,{beds:m.beds||[],columns:m.columns,now:h}),m.key==="kamishibai"&&e.jsx(Ne,{beds:m.beds||[],columns:m.columns,opsSettings:i,now:h}),m.key==="summary"&&e.jsx(we,{metrics:k,unitName:s})]}),t.rotationEnabled&&x.length>1&&e.jsx("div",{className:"progress-bar-container",children:e.jsx("div",{className:"progress-bar-fill",style:{width:`${c}%`}})}),e.jsxs("div",{className:"tv-screen-indicator text-muted text-xs font-bold uppercase tracking-widest opacity-50",children:[m.label," • ",u+1,"/",x.length]})]}):e.jsx("div",{className:"p-8 text-center text-2xl",children:"Nenhuma tela habilitada."})},Ae=()=>{const{theme:a,toggleTheme:t}=J();return e.jsx("button",{className:"theme-toggle",onClick:t,"aria-label":"Toggle Theme",title:a==="light"?"Ativar modo escuro":"Ativar modo claro",children:a==="light"?e.jsx("svg",{fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"})}):e.jsx("svg",{fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M6.343 6.343l.707-.707M14.99 12a2.99 2.99 0 11-5.98 0 2.99 2.99 0 015.98 0z"})})})},Ve=()=>{const[a]=Y(),t=a.get("unit")||"A",s=a.get("screen")||void 0,i=Z(),{isAdmin:h}=X(),[l,u]=o.useState([]),[b,c]=o.useState(null),[g,p]=o.useState(null),[x,k]=o.useState(!0),[y,m]=o.useState(null),[n,N]=o.useState(new Date),[r,v]=o.useState(null),[d,w]=o.useState(null),[D,M]=o.useState(null),[V,F]=o.useState(null);o.useEffect(()=>{const f=setInterval(()=>N(new Date),3e4);return()=>clearInterval(f)},[]);const{huddlePending:W,huddleSubtext:Q}=o.useMemo(()=>{if(!d)return{huddlePending:!1,huddleSubtext:""};const f=d.huddleSchedule??C,S=L(f),A=!d.lastHuddleShiftKey||d.lastHuddleShiftKey!==S;let P="Nenhum huddle registrado neste turno";if(d.lastHuddleAt){const j=d.lastHuddleAt,I=j instanceof Date?j:typeof j=="string"?new Date(j):j.toDate?.()??null;if(I){const G=Math.round((n.getTime()-I.getTime())/36e5);P=`Último: ${d.lastHuddleType??""} há ${G}h`}}return{huddlePending:A,huddleSubtext:P}},[d,n]);o.useEffect(()=>{const f=j=>{console.error("TV Dashboard Error:",j),m("Perda de conexão com o banco de dados. Tentando reconectar...")},S=ee.listenToBeds(t,j=>{u(j),v(new Date),m(null)},f),A=ae.listenToSettings(t,j=>{c(j),v(new Date),m(null)},f);te.getUnit(t).then(p).catch(f).finally(()=>{k(!1)});const P=se.subscribeUnitOpsSettings(t,w);return()=>{S(),A(),P()}},[t]),o.useEffect(()=>{if(!d)return;const f=d.huddleSchedule??C,S=L(f),A=me(S),P=z.listenToHuddle(t,S,M),j=z.listenToHuddle(t,A,F);return()=>{P(),j()}},[t,d,n.getHours()]);const B=o.useMemo(()=>l?he(l,ue,n).total:0,[l,n]),T=(D?.topActions||[]).filter(f=>f.status==="open").length,E=(V?.topActions||[]).filter(f=>f.status==="open").length;return x?e.jsxs("div",{className:"h-screen flex flex-col bg-app overflow-hidden p-8",children:[e.jsxs("header",{className:"flex justify-between items-center mb-12",children:[e.jsxs("div",{className:"flex items-center gap-6",children:[e.jsx("div",{className:"skeleton h-16 w-64"}),e.jsx("div",{className:"skeleton h-10 w-24"})]}),e.jsx("div",{className:"skeleton h-16 w-80"})]}),e.jsx("main",{className:"flex-1 flex gap-8",children:e.jsx("div",{className:"flex-1 skeleton h-full rounded-2xl"})})]}):y&&l.length===0?e.jsxs("div",{className:"h-screen flex flex-col items-center justify-center bg-app p-8 text-center",children:[e.jsx("div",{className:"text-6xl mb-6",children:"📡"}),e.jsx("h1",{className:"text-3xl font-serif mb-4",children:"Problema de Conexão"}),e.jsx("p",{className:"text-muted max-w-lg mb-8",children:"Não foi possível estabelecer uma conexão em tempo real com o servidor. O painel tentará se reconectar automaticamente assim que a rede estiver disponível."}),e.jsx("div",{className:"text-sm font-mono bg-surface-2 p-3 rounded border border-danger/20 text-danger",children:y})]}):g?e.jsxs("div",{className:"tv-dashboard h-screen flex flex-col",children:[e.jsxs("header",{className:"tv-header flex justify-between items-center relative",children:[e.jsx("div",{className:"tv-header-left",children:e.jsx("span",{className:"unit-badge",children:g.name})}),e.jsx("h1",{className:"tv-title absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none",children:e.jsx("img",{src:"/bedsight-flow-logo.png",alt:"BedSight Flow",className:"w-auto object-contain",style:{height:"40px",maxWidth:"calc(100vw - 250px)"}})}),e.jsxs("div",{className:"tv-header-controls flex items-center gap-6",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[h&&e.jsx("button",{className:"theme-toggle !text-primary hover:!bg-primary/10",onClick:()=>i("/admin"),"aria-label":"Voltar para Admin",title:"Voltar para Admin",children:e.jsx(pe,{size:20})}),e.jsx("button",{className:"theme-toggle",onClick:()=>i(`/editor?unit=${t}`),"aria-label":"Abrir versão Mobile",title:"Abrir versão Mobile",children:e.jsx(xe,{size:20})}),e.jsx(Ae,{})]}),e.jsxs("div",{className:"tv-date-wrapper text-right hidden md:flex flex-col items-end",children:[e.jsx("div",{className:"tv-date text-2xl font-serif mt-1",children:n.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}),e.jsx("div",{className:"tv-time text-muted font-bold tracking-widest text-xl",children:n.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}),d&&e.jsxs("div",{className:"tv-mode text-[10px] text-muted-more uppercase tracking-tighter mt-0.5 opacity-60",children:["Modo: ",d.kanbanMode]}),r&&e.jsxs("div",{className:"tv-last-updated text-[10px] text-muted-more uppercase tracking-tighter mt-0.5 opacity-60",children:["Atualizado às ",r.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})]})]})]})]}),W&&e.jsxs("div",{className:"huddle-pending-badge",role:"alert","aria-live":"polite",style:{background:"var(--state-warning-bg)",borderBottom:"2px solid var(--state-warning)",color:"var(--state-warning)",padding:"0.4rem 2rem",display:"flex",alignItems:"center",gap:"0.75rem",fontSize:"0.75rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"},children:[e.jsx("span",{children:"⚠ HUDDLE PENDENTE"}),e.jsx("span",{style:{fontWeight:400,opacity:.75,textTransform:"none",letterSpacing:0},children:Q})]}),(T>0||E>0||B>0)&&e.jsxs("div",{className:"flex bg-surface-2 border-b border-divider divide-x divide-divider",children:[T>0&&e.jsxs("div",{className:"flex-1 px-4 py-2 flex items-center justify-center gap-2 text-warning animate-pulse",style:{fontWeight:700},children:[e.jsx(H,{size:18}),e.jsxs("span",{className:"text-sm tracking-widest uppercase",children:["Top 3 Ações: ",e.jsxs("span",{className:"text-foreground",children:[T," Aberta",T>1?"s":""]})]})]}),E>0&&e.jsxs("div",{className:"flex-1 px-4 py-2 flex items-center justify-center gap-2 text-primary",style:{fontWeight:700},children:[e.jsx(H,{size:18}),e.jsxs("span",{className:"text-sm tracking-widest uppercase",children:["Review Pendente: ",e.jsxs("span",{className:"text-foreground",children:[E," Ação",E>1?"ões":""]})]})]}),B>0&&e.jsxs("div",{className:"flex-1 px-4 py-2 flex items-center justify-center gap-2 text-danger animate-pulse bg-danger/10",style:{fontWeight:700},children:[e.jsx(fe,{size:18}),e.jsxs("span",{className:"text-sm tracking-widest uppercase",children:["Escalonamentos: ",e.jsxs("span",{className:"text-foreground",children:[B," Crítico",B>1?"s":""]})]})]})]}),e.jsx("main",{className:"tv-main flex-1 overflow-hidden",children:b&&e.jsx(Pe,{beds:l,settings:b,opsSettings:d,unitName:g?.name,now:n,forceScreen:s})})]}):e.jsxs("div",{className:"h-screen flex flex-col items-center justify-center bg-app gap-4",children:[e.jsx("div",{className:"text-3xl font-serif",children:"Unidade não encontrada"}),e.jsxs("div",{className:"text-muted",children:["Verifique o parâmetro ?unit=",t," na URL."]})]})};export{Ve as default};
