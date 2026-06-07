import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Zap, Activity, ShieldAlert, Sliders } from 'lucide-react';

function Tc() {
  // Estados dos parâmetros de entrada
  const [inCircuito, setInCircuito] = useState(400); // Corrente Nominal do Circuito (A)
  const [iprimarioTC, setIprimarioTC] = useState(400); // Relação do TC (Primário)
  const [isecundarioTC, setIsecundarioTC] = useState(5); // Relação do TC (Secundário)
  const [iCc, setICc] = useState(8000); // Corrente de Curto-Circuito (A)
  const [xOverR, setXOverR] = useState(10); // Relação X/R da rede (Componente CC)
  const [frequencia, setFrequencia] = useState(60); // Frequência do sistema (Hz)
  
  // Parâmetros do TC e Carga
  const [vClasse, setVClasse] = useState(200); // Classe de Tensão de exitação (Ex: C200)
  const [rBurden, setRBurden] = useState(1.5); // Resistência da Carga + Cabos (Ohms)
  const [rInterna, setRInterna] = useState(0.4); // Resistência interna do enrolamento secundário (Ohms)

  // Relação de transformação (RTC)
  const rtc = iprimarioTC / isecundarioTC;

  // Cálculos analíticos baseados na IEEE Std C37.110
  const resultadosAnaliticos = useMemo(() => {
    const omega = 2 * Math.PI * frequencia;
    const tCc = iCc / rtc; // Corrente de curto secundária simétrica (Rms)
    const zTotal = rBurden + rInterna; // Impedância total do circuito secundário

    // 1. Tensão de saturação simétrica (Regime Permanente)
    const vSatSimetrica = tCc * zTotal;

    // 2. Tensão de saturação considerando a componente transitória CC (Assimetria máxima)
    // De acordo com a IEEE Std C37.110, o fluxo pode crescer teoricamente até (1 + X/R) vezes
    const vSatTransitoria = vSatSimetrica * (1 + xOverR);

    // Fator de Saturação (SF) aproximado em regime
    const sf = vClasse / (vSatSimetrica * Math.sqrt(2));
    const statusSat = vSatTransitoria > vClasse ? "Satura no Transitório" : vSatSimetrica > vClasse ? "Satura em Regime" : "Seguro (Sem Saturação)";

    return {
      tCc,
      zTotal,
      vSatSimetrica,
      vSatTransitoria,
      statusSat,
      sf
    };
  }, [iCc, rtc, rBurden, rInterna, vClasse, xOverR, frequencia]);

  // Geração de pontos para o gráfico de formas de onda (Simulação Temporal)
  const dadosGrafico = useMemo(() => {
    const pontos = [];
    const omega = 2 * Math.PI * frequencia;
    const Ta = xOverR / omega; // Constante de tempo de decaimento do CC (s)
    
    const PeakSec = (iCc / rtc) * Math.sqrt(2);
    const zTotal = rBurden + rInterna;
    
    // Definição empírica do limite de fluxo magnético proporcional à VClasse do TC
    const fluxMax = vClasse / omega; 
    let flux = 0; // Fluxo magnético acumulado instantâneo
    const period = 1 / frequencia;
    const totalTime = 10 * period; // 10 ciclos de simulação
    const dt = 0.0002; // Passo de integração (0.2 ms)
    const numPontos = Math.max(200, Math.round(totalTime / dt)); // pontos suficientes para 10 ciclos

    for (let i = 0; i < numPontos; i++) {
      const t = i * dt;
      
      // Corrente Primária Referenciada ao Secundário (Ideal com assimetria máxima)
      const iIdeal = PeakSec * (Math.sin(omega * t - Math.PI / 2) + Math.exp(-t / Ta));
      
      // Cálculo simplificado do Fluxo Magnético: dPhi/dt = V = I * Z
      // Na exitação real, a corrente de magnetização desvia a corrente quando o fluxo atinge o topo saturável
      const dFlux = iIdeal * zTotal * dt;
      flux += dFlux;

      // Modelagem de saturação por ceifamento (Histerese simplificada/Corte de exitação)
      let iSaturada = iIdeal;
      if (Math.abs(flux) > fluxMax) {
        // Quando o núcleo satura, a impedância de magnetização desaba. 
        // A corrente secundária cai abruptamente em direção a zero durante o pico de fluxo
        const fatorReducao = Math.exp(-5 * (Math.abs(flux) - fluxMax) / fluxMax);
        iSaturada = iIdeal * fatorReducao;
      }

      pontos.push({
        tempo: (t * 1000).toFixed(1), // Convertido para ms
        'Ideal (Sem Saturação)': parseFloat(iIdeal.toFixed(2)),
        'Real (Saturada)': parseFloat(iSaturada.toFixed(2)),
      });
    }
    return pontos;
  }, [iCc, rtc, rBurden, rInterna, vClasse, xOverR, frequencia]);

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="text-amber-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dimensionamento & Análise de TC</h1>
            <p className="text-sm text-slate-400">Análise de Saturação Transitória e de Regime Permanente conforme IEEE Std C37.110</p>
          </div>
        </div>
        <div className="bg-slate-50 px-3 py-1.5 rounded-md text-xs font-mono text-slate-700 border border-slate-100">
          RTC: {rtc}:1
        </div>
      </div>

      {/* Grid Principal */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1 e 2: Entradas e Controles */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
            <Sliders className="text-blue-400 w-5 h-5" />
              <h2 className="text-lg font-semibold">Parâmetros do Sistema</h2>
          </div>

          {/* Dados do Circuito */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Corrente Nominal do Circuito (A)</label>
              <input 
                type="number" 
                value={inCircuito} 
                onChange={(e) => setInCircuito(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Corrente de Curto-Circuito Simétrica (A)</label>
              <input 
                type="number" 
                value={iCc} 
                onChange={(e) => setICc(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Relação X/R (Fator CC)</label>
                <input 
                  type="number" 
                  value={xOverR} 
                  onChange={(e) => setXOverR(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Frequência (Hz)</label>
                <input 
                  type="number" 
                  value={frequencia} 
                  onChange={(e) => setFrequencia(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-700 pb-2 pt-2">
            <Activity className="text-emerald-400 w-5 h-5" />
            <h2 className="text-lg font-semibold">Dados Técnicos do TC</h2>
          </div>

          {/* Dados do TC */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Primário TC (A)</label>
                <input 
                  type="number" 
                  value={iprimarioTC} 
                  onChange={(e) => setIprimarioTC(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Secundário TC (A)</label>
                <select 
                  value={isecundarioTC} 
                  onChange={(e) => setIsecundarioTC(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value={5}>5 A</option>
                  <option value={1}>1 A</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Classe de Tensão de Excitação C (V)</label>
                <select 
                  value={vClasse} 
                  onChange={(e) => setVClasse(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                >
                <option value={50}>C50</option>
                <option value={100}>C100</option>
                <option value={200}>C200</option>
                <option value={400}>C400</option>
                <option value={800}>C800</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Carga + Cabos R (Ω)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={rBurden} 
                  onChange={(e) => setRBurden(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">R Interna TC (Ω)</label>
                <input 
                  type="number" 
                  step="0.05"
                  value={rInterna} 
                  onChange={(e) => setRInterna(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 3: Resultados numéricos e Gráfico */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Cards de Resultados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">Tensão Desejada (Simétrica)</span>
              <div className="text-2xl font-bold text-slate-100 mt-1">
                {resultadosAnaliticos.vSatSimetrica.toFixed(1)} <span className="text-sm font-normal text-slate-500">V_rms</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Regime permanente sob falta</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">Tensão Requerida (Transitório)</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {resultadosAnaliticos.vSatTransitoria.toFixed(1)} <span className="text-sm font-normal text-slate-400">V</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Considerando componente CC (1+X/R)</p>
            </div>
            <div className={`p-4 rounded-xl border ${
              resultadosAnaliticos.statusSat.includes("Seguro") 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <span className="text-xs text-slate-400 font-medium">Diagnóstico do Núcleo</span>
              <div className="text-lg font-bold mt-1 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {resultadosAnaliticos.statusSat}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Fator de exitação vs limite classe C</p>
            </div>

          </div>

          {/* Bloco do Gráfico */}
          <div className="bg-gray-50 p-5 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-blue-400 w-5 h-5" />
                <h3 className="text-base font-semibold">Curva de Resposta de Corrente Secundária (A_pico)</h3>
              </div>
              <span className="text-xs text-slate-400">Eixo X: Tempo (ms)</span>
            </div>

            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6eef6" />
                  <XAxis dataKey="tempo" stroke="#0f172a" fontSize={12} />
                  <YAxis stroke="#0f172a" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e6e6e6', color: '#0f172a' }}
                    labelStyle={{ color: '#0f172a' }}
                    itemStyle={{ color: '#0f172a' }}
                    labelFormatter={(value) => `Tempo: ${value} ms`}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle"/>
                  <Line 
                    type="monotone" 
                    dataKey="Ideal (Sem Saturação)" 
                    stroke="#2563eb" 
                    strokeDasharray="5 5"
                    strokeWidth={2} 
                    dot={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Real (Saturada)" 
                    stroke="#dc2626" 
                    strokeWidth={2.5} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 p-3 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs text-slate-400 space-y-1">
              <p>• <strong>Nota Teórica:</strong> A curva vermelha demonstra o comportamento clássico de um TC saturando devido à componente contínua[cite: 143, 147]. À medida que o fluxo integralizado da tensão de malha (V = I · Z_total) atinge o joelho de saturação, a reprodução secundária é interrompida, reduzindo a corrente eficaz enviada ao relé[cite: 147, 287].</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Tc;