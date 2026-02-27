import React from 'react';

type AnalyticsEmptyStateProps = {
    type: 'empty' | 'error';
    message?: string;
    suggestion?: string;
};

export const AnalyticsEmptyState: React.FC<AnalyticsEmptyStateProps> = ({ type, message, suggestion }) => {
    const isError = type === 'error';

    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 rounded-xl border border-gray-100 min-h-[200px]">
            <div className={`flex items-center justify-center w-12 h-12 mb-4 rounded-full ${isError ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                {isError ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                )}
            </div>

            <h3 className={`text-base font-semibold mb-1 ${isError ? 'text-red-800' : 'text-gray-900'}`}>
                {message || (isError ? 'Erro ao carregar dados' : 'Nenhum dado no período')}
            </h3>

            <p className="text-sm text-gray-500 max-w-sm">
                {suggestion || (isError ? 'Tente atualizar a página ou selecionar outro período.' : 'Não há registros suficientes para o período selecionado.')}
            </p>
        </div>
    );
};
