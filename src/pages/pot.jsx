import React, { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

function Pot() {
  // Estados para as entradas (agora controlados como valores RMS)
  const [vRms, setVRms] = useState(127);
  const [angV, setAngV] = useState(0);
  const [iRms, setIRms] = useState(10);
  const [angI, setAngI] = useState(-30);

  // Frequência padrão da rede (60Hz)
  const f = 60;
  const w = 2 * Math.PI * f;

  // Cálculos consolidados no useMemo
  const { timeData, P, Q, S, defasagemGraus } = useMemo(() => {
    const data = [];
    const ciclos = 2;
    const periodo = 1 / f;
    const pontos = 100;

    // Convertendo ângulos para radianos
    const angV_rad = (angV * Math.PI) / 180;
    const angI_rad = (angI * Math.PI) / 180;

    // Encontrando os valores de Pico para plotagem da senoide no tempo
    const vp = vRms * Math.SQRT2;
    const ip = iRms * Math.SQRT2;

    for (let i = 0; i <= pontos; i++) {
      const t = (i / pontos) * (ciclos * periodo);
      const rad = w * t; 
      
      // Equações no domínio do tempo com os valores de pico
      const vInst = vp * Math.sin(rad + angV_rad);
      const iInst = ip * Math.sin(rad + angI_rad);
      const pInst = vInst * iInst;

      data.push({
        radianos: parseFloat(rad.toFixed(2)),
        Tensão: parseFloat(vInst.toFixed(2)),
        Corrente: parseFloat(iInst.toFixed(2)),
        Potência: parseFloat(pInst.toFixed(2)),
      });
    }

    const defasagem_rad = angV_rad - angI_rad;
    const defasagem_graus = angV - angI;
    
    // Potências (calculadas diretamente com os módulos RMS)
    const calcS = vRms * iRms;
    const calcP = calcS * Math.cos(defasagem_rad);
    const calcQ = calcS * Math.sin(defasagem_rad);

    return { 
      timeData: data, 
      P: parseFloat(calcP.toFixed(2)), 
      Q: parseFloat(calcQ.toFixed(2)),
      S: parseFloat(calcS.toFixed(2)),
      defasagemGraus: defasagem_graus
    };
  }, [vRms, angV, iRms, angI, w]);

  // Lógica para o Diagrama Polar em SVG
  const renderPolarDiagram = () => {
    const viewBoxSize = 300;
    const center = viewBoxSize / 2;
    const maxRadius = 120; 
    
    const maxScale = Math.max(S * 1.2, 100); 
    const scale = maxRadius / maxScale;

    const p_px = center + P * scale;
    const q_px = center - Q * scale; 

    return (
        <svg width="100%" height="100%" viewBox="0 0 300 300" className="max-w-65 mx-auto drop-shadow-sm">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
          </marker>
        </defs>

        {/* Círculos Polares (Módulos de S) */}
        <circle cx={center} cy={center} r={maxRadius} stroke="#e5e7eb" strokeWidth="1" fill="none" strokeDasharray="4 4" />
        <circle cx={center} cy={center} r={maxRadius * 0.66} stroke="#e5e7eb" strokeWidth="1" fill="none" strokeDasharray="4 4" />
        <circle cx={center} cy={center} r={maxRadius * 0.33} stroke="#e5e7eb" strokeWidth="1" fill="none" strokeDasharray="4 4" />

        {/* Eixos Reais e Imaginários (P e Q) */}
        <line x1="30" y1={center} x2="270" y2={center} stroke="#9ca3af" strokeWidth="1" />
        <line x1={center} y1="30" x2={center} y2="270" stroke="#9ca3af" strokeWidth="1" />
        
        {/* Rótulos dos Eixos */}
        <text x="275" y="154" fontSize="10" fill="#4b5563" fontWeight="bold">P</text>
        <text x="154" y="25" fontSize="10" fill="#4b5563" fontWeight="bold">jQ</text>

        {/* Linhas de Projeção */}
        {S > 0 && (
          <>
            <line x1={p_px} y1={center} x2={p_px} y2={q_px} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={center} y1={q_px} x2={p_px} y2={q_px} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
          </>
        )}

        {/* Fasor de Potência Aparente (S) */}
        <line 
          x1={center} 
          y1={center} 
          x2={p_px} 
          y2={q_px} 
          stroke="#8b5cf6" 
          strokeWidth="3" 
          markerEnd="url(#arrowhead)" 
        />
        
        <circle cx={center} cy={center} r="3" fill="#374151" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Análise de Potência Elétrica</h2>

      {/* Painel de Controles com Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 p-6 rounded-md border border-gray-200">
        {/* Tensão */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-blue-700 flex items-center justify-between">
            Sinal de Tensão <span className="text-sm bg-blue-100 px-2 py-1 rounded text-blue-800">Referência</span>
          </h3>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <label>Valor RMS (V)</label> <span>{vRms} V</span>
            </div>
            <input 
              type="range" min="0" max="500" step="1" value={vRms} 
              onChange={(e) => setVRms(Number(e.target.value))}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <label>Ângulo Inicial (θv)</label> <span>{angV}°</span>
            </div>
            <input 
              type="range" min="-180" max="180" step="1" value={angV} 
              onChange={(e) => setAngV(Number(e.target.value))}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        {/* Corrente */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-red-700">Sinal de Corrente</h3>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <label>Valor RMS (A)</label> <span>{iRms} A</span>
            </div>
            <input 
              type="range" min="0" max="100" step="1" value={iRms} 
              onChange={(e) => setIRms(Number(e.target.value))}
              className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <label>Ângulo Inicial (θi)</label> <span>{angI}°</span>
            </div>
            <input 
              type="range" min="-180" max="180" step="1" value={angI} 
              onChange={(e) => setAngI(Number(e.target.value))}
              className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>
        </div>
      </div>

      {/* Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        
        {/* Gráfico 1: Tensão e Corrente */}
        <div className="h-80 w-full flex flex-col items-center">
          <h4 className="font-medium text-gray-700 mb-2">Formas de Onda: v(t) e i(t)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="radianos" label={{ value: 'Ângulo (rad)', position: 'insideBottomRight', offset: -5 }} />
              <YAxis yAxisId="left" stroke="#2563eb" />
              <YAxis yAxisId="right" orientation="right" stroke="#dc2626" />
              <Tooltip labelFormatter={(value) => `${value} rad`} />
              <Legend verticalAlign="top" height={36}/>
              <Line yAxisId="left" type="monotone" dataKey="Tensão" stroke="#2563eb" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="Corrente" stroke="#dc2626" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 2: Potência Instantânea */}
        <div className="h-80 w-full flex flex-col items-center">
          <h4 className="font-medium text-gray-700 mb-2">Potência Instantânea: p(t)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="radianos" label={{ value: 'Ângulo (rad)', position: 'insideBottomRight', offset: -5 }} />
              <YAxis stroke="#16a34a" />
              <Tooltip labelFormatter={(value) => `${value} rad`} />
              <Legend verticalAlign="top" height={36}/>
              <Line type="monotone" dataKey="Potência" stroke="#16a34a" dot={false} strokeWidth={2} isAnimationActive={false} />
              <ReferenceLine y={0} stroke="#000" />
              <ReferenceLine y={P} stroke="#ca8a04" strokeDasharray="5 5" label="P (Média)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* DIV Unificada: Diagrama Polar + Valores de Saída */}
        <div className="w-full flex flex-col items-center lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
          <h4 className="font-medium text-gray-700 mb-4 w-full text-center lg:text-left border-b pb-2">
            Diagrama Fasorial & Grandezas Resultantes (Polar PxQ)
          </h4>
          
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-16">
            {/* Sub-div do Gráfico Polar */}
            <div className="flex-1 flex justify-center items-center min-h-65">
              {renderPolarDiagram()}
            </div>

            {/* Sub-div dos Módulos/Campos de Potência */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-4 w-full md:w-64 shrink-0">
              <div className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100 shadow-2xs">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Potência Ativa (P)</span>
                <span className="text-blue-700 text-xl font-bold">{P} W</span>
              </div>
              
              <div className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100 shadow-2xs">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Potência Reativa (Q)</span>
                <span className="text-red-700 text-xl font-bold">{Q} VAr</span>
              </div>
              
              <div className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100 shadow-2xs">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Potência Aparente (S)</span>
                <span className="text-purple-700 text-xl font-bold">{S} VA</span>
              </div>
              
              <div className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100 shadow-2xs col-span-2 md:col-span-1">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Fator de Potência</span>
                <span className="text-gray-800 text-lg font-bold flex items-baseline gap-1">
                  {S === 0 ? "0.00" : Math.abs(Math.cos((defasagemGraus * Math.PI) / 180)).toFixed(3)}
                  <span className="text-xs font-normal text-gray-500">
                    {Q > 0 ? "Ind" : Q < 0 ? "Cap" : ""}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Pot;