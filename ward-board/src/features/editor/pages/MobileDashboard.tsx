import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Bed, Unit, SpecialtyKey } from '../../../domain/types';
import { DischargeEstimateLabel } from '../../../domain/types';
import { getShortSpecialty, getVisibleSpecialties, KAMISHIBAI_DOMAINS as SUPPORT_SPECIALTIES } from '../../../domain/specialtyUtils';
import { BedsRepository } from '../../../repositories/BedsRepository';
import { UnitsRepository } from '../../../repositories/UnitsRepository';

const MobileDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const unitId = searchParams.get('unit') || 'A';

    const [beds, setBeds] = useState<Bed[]>([]);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = BedsRepository.listenToBeds(unitId, (data: Bed[]) => {
            setBeds(data);
            setLoading(false);
        });

        UnitsRepository.getUnit(unitId).then(setUnit);

        return () => unsubscribe();
    }, [unitId]);

    const filterType = searchParams.get('filter') || '';
    const [now] = useState(() => Date.now());

    // Safety generic date parser
    const parseDate = (val: unknown): Date => {
        if (!val) return new Date();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = val as any;
        if (typeof v.toDate === 'function') return v.toDate();
        if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
        if (typeof v === 'string' || typeof v === 'number') return new Date(v);
        return new Date();
    };

    const filteredBeds = beds.filter(bed => {
        if (!filterType) return true;

        if (filterType === 'blocked') {
            return bed.mainBlocker && bed.mainBlocker.trim().length > 0;
        }

        if (filterType === 'kamishibai=pending' || filterType === 'kamishibai=blocked') {
            const targetStatus = filterType.split('=')[1]; // pending or blocked
            if (!bed.kamishibai) return false;
            return Object.values(bed.kamishibai).some(k => k.status === targetStatus);
        }

        if (filterType.startsWith('stale')) {
            const hoursStr = filterType.replace('stale', '').replace('h', '');
            const hours = parseInt(hoursStr, 10);
            if (isNaN(hours)) return true;

            const lastUpdate = parseDate(bed.updatedAt);
            const diffHours = (now - lastUpdate.getTime()) / (1000 * 60 * 60);
            return diffHours > hours;
        }

        return true;
    });

    if (loading) {
        return (
            <div className="p-4 mobile-dashboard">
                <header className="mb-6 flex justify-between items-center">
                    <div className="skeleton h-8 w-32" />
                    <div className="skeleton h-4 w-16" />
                </header>
                <div className="grid gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-surface-1 p-4 rounded-lg border shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="skeleton h-6 w-12" />
                                <div className="skeleton h-5 w-20" />
                            </div>
                            <div className="skeleton h-6 w-3/4 mb-4" />
                            <div className="flex justify-between items-end">
                                <div className="skeleton h-4 w-1/2" />
                                <div className="flex gap-1">
                                    {[1, 2, 3].map(j => <div key={j} className="skeleton h-2 w-2 rounded-full" />)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 mobile-dashboard">
            <header className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-serif">Leitos {unit?.name}</h2>
                <div className="text-sm text-muted">{filteredBeds.length} {filterType ? `(de ${beds.length}) ` : ''}ativos</div>
            </header>

            <div className="grid gap-4">
                {filteredBeds.map(bed => (
                    <div
                        key={bed.id}
                        className="bg-surface-1 p-4 rounded-lg border shadow-sm active:scale-95 transition-transform"
                        onClick={() => navigate(`bed/${bed.id}?unit=${unitId}`)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xl font-bold">{bed.number}</span>
                            <span className={`unit-badge text-xs ${getDischargeColorClass(bed.expectedDischarge)}`}>
                                {DischargeEstimateLabel[bed.expectedDischarge]}
                            </span>
                        </div>
                        <div className="text-lg mb-2 flex justify-between items-center">
                            <span>{bed.patientAlias || '--'}</span>
                            <div className="flex gap-1">
                                {getVisibleSpecialties(bed.involvedSpecialties || []).map(s => (
                                    <span key={s} className="px-1 h-5 rounded bg-surface-2 text-[8px] font-bold border flex items-center justify-center text-secondary" title={s}>
                                        {getShortSpecialty(s)}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="text-sm text-secondary truncate max-w-200">
                                {bed.mainBlocker || 'Sem bloqueador'}
                            </div>
                            <div className="flex gap-1">
                                {SUPPORT_SPECIALTIES.map((s, i) => {
                                    const h = bed.kamishibai[s as SpecialtyKey];
                                    if (!h) return null;
                                    return <div key={i} className={`w-2 h-2 rounded-full ${h.status}`} />;
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const getDischargeColorClass = (estimate: string) => {
    switch (estimate) {
        case '24h': return 'state-success-bg';
        case '2-3_days': return 'state-warning-bg';
        case '>3_days': return 'state-danger-bg';
        default: return '';
    }
};

export default MobileDashboard;
