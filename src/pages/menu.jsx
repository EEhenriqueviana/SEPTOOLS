import React, { useState } from 'react';
import { LineChart, Share2, ShieldAlert, Activity, Zap, ArrowLeft } from 'lucide-react';
// Seus componentes importados
import Cc from './cc';
import Coord from './coord';
import Harm from './harm';
import Sim from './sim';
import Tc from './tc';
import Pot from './pot';

function Menu() {
  // Estado interno para controlar qual tela exibir no "body" do componente
  // Começa como 'menu' para exibir a grade de opções
  const [telaAtiva, setTelaAtiva] = useState('menu');

  // Mapeamento dos IDs para os respectivos componentes importados
  const ferramentas = [
    {
      id: 'coordenograma',
      nome: 'Coordenograma',
      componente: <Coord onVoltar={() => setTelaAtiva('menu')} />,
      icone: <LineChart className="w-8 h-8 text-blue-600" />,
      descricao: 'Visualização e parametrização de curvas de proteção (ANSI/IEC).'
    },
    {
      id: 'componentes_simetricas',
      nome: 'Componentes Simétricas',
      componente: <Sim onVoltar={() => setTelaAtiva('menu')} />,
      icone: <Share2 className="w-8 h-8 text-emerald-600" />,
      descricao: 'Cálculo de sequências positiva, negativa e zero para análise de faltas.'
    },
    {
      id: 'dimensionamento_tcs',
      nome: 'Dimensionamento de TCs',
      componente: <Tc onVoltar={() => setTelaAtiva('menu')} />,
      icone: <ShieldAlert className="w-8 h-8 text-amber-600" />,
      descricao: 'Verificação de saturação e especificação de transformadores de corrente.'
    },
    {
      id: 'armonicas',
      nome: 'Harmônicas',
      componente: <Harm onVoltar={() => setTelaAtiva('menu')} />,
      icone: <Activity className="w-8 h-8 text-purple-600" />,
      descricao: 'Análise de distorção harmônica (THD) e decomposição de espectro.'
    },
    {
      id: 'curto_circuito',
      nome: 'Curto-Circuito',
      componente: <Cc onVoltar={() => setTelaAtiva('menu')} />,
      icone: <Zap className="w-8 h-8 text-red-600" />,
      descricao: 'Cálculos de faltas simétricas e assimétricas em barras do sistema.'
    },
    {
      id: 'potencia',
      nome: 'Potência',
      componente: <Pot onVoltar={() => setTelaAtiva('menu')} />,
      icone: <ShieldAlert className="w-8 h-8 text-amber-600" />,
      descricao: 'Cálculo de potência ativa, reativa e aparente em sistemas elétricos.'
    }
  ];

  // Se a tela ativa não for o menu, renderiza o componente correspondente
  if (telaAtiva !== 'menu') {
    const ferramentaSelecionada = ferramentas.find(f => f.id === telaAtiva);
    
    return (
      <div className="min-h-screen bg-slate-50 p-6 sm:p-12">
        <div className="max-w-7xl mx-auto">
          {/* Barra superior padrão de navegação interna */}
          <button
            onClick={() => setTelaAtiva('menu')}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltando ao Menu Principal
          </button>
          
          {/* Renderiza o componente importado (cc, coord, harm, etc.) */}
          {ferramentaSelecionada?.componente}
        </div>
      </div>
    );
  }

  // Renderização padrão da Grid do Menu
  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho do Menu */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Sistemas Elétricos de Potência
          </h1>
          <p className="text-slate-500 mt-2">
            Selecione uma ferramenta de cálculo e análise para iniciar.
          </p>
        </header>

        {/* Grid de Ferramentas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ferramentas.map((ferramenta) => (
            <div
              key={ferramenta.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Container do Ícone */}
                <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center mb-4 border border-slate-100">
                  {ferramenta.icone}
                </div>
                
                {/* Nome da Funcionalidade */}
                <h2 className="text-xl font-semibold text-slate-800 mb-2">
                  {ferramenta.nome}
                </h2>
                
                {/* Descrição */}
                <p className="text-sm text-slate-500 mb-6 line-clamp-2">
                  {ferramenta.descricao}
                </p>
              </div>

              {/* Botão Acessar */}
              <button
                onClick={() => setTelaAtiva(ferramenta.id)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 flex items-center justify-center text-sm"
              >
                Acessar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Menu;