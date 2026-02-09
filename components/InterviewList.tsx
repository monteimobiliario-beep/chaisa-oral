
import React, { useState } from 'react';
import { SavedSession } from '../types';

interface InterviewListProps {
  sessions: SavedSession[];
  onSelect: (session: SavedSession) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export const InterviewList: React.FC<InterviewListProps> = ({ sessions, onSelect, onDelete, onNew }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter(s => 
    s.data.metadata.intervieweeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.data.metadata.interviewId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatus = (session: SavedSession) => {
    const meta = session.data.metadata;
    const hasIssues = !meta.intervieweeName || !meta.interviewPlace || session.data.individuals.length === 0;
    return hasIssues ? 'INCOMPLETO' : 'CONCLUÍDO';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Cabeçalho de Contexto */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lista de Entrevistas</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Gerencie e revise os registros MZ11 coletados em campo.</p>
        </div>
        <button 
          onClick={onNew}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
          Nova Entrevista
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Pesquisar por nome ou ID da entrevista..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {sessions.length} Total
          </div>
          <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {sessions.filter(s => getStatus(s) === 'INCOMPLETO').length} Pendentes
          </div>
        </div>
      </div>

      {/* Tabela de Dados Estilo FamilySearch */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100 text-left">
          <thead className="bg-slate-50">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
              <th className="px-6 py-5">Status</th>
              <th className="px-6 py-5">ID</th>
              <th className="px-6 py-5">Entrevistado</th>
              <th className="px-6 py-5">Localidade</th>
              <th className="px-6 py-5">Data</th>
              <th className="px-6 py-5 text-center">Registros</th>
              <th className="px-6 py-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-slate-400 font-bold text-sm">Nenhum registro encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSessions.map((session) => {
                const status = getStatus(session);
                const interviewId = session.data.metadata.interviewId;
                const place = session.data.metadata.interviewPlace;
                
                return (
                  <tr 
                    key={session.id} 
                    className="group hover:bg-blue-50/20 transition-colors cursor-pointer"
                    onClick={() => onSelect(session)}
                  >
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                        status === 'CONCLUÍDO' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'CONCLUÍDO' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {interviewId && (
                        <code className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          {interviewId}
                        </code>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                        {session.data.metadata.intervieweeName || ''}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-bold text-slate-500 truncate max-w-[150px]">
                        {place || ''}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-medium text-slate-400">
                        {new Date(session.timestamp).toLocaleDateString('pt-BR')}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                        {session.data.individuals.length}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSelect(session); }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Informacional */}
      <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest px-2">
        <span>© 2024 Oral-Gen System</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sincronizado</span>
          <span>Versão 2.1.0-Pedigree</span>
        </div>
      </div>
    </div>
  );
};
