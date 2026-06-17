import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, Trash2, Sliders, Zap, Edit2, Check, BarChart3 } from 'lucide-react';

function Harm() {
  // Lista de harmônicas ativas
  const [harmonics, setHarmonics] = useState([
    { order: 1, mag: 127, deg: 0 } // Fundamental padrão (127V / 60Hz)
  ]);

  // Estados do formulário de inserção/edição
  const [inputOrder, setInputOrder] = useState('3');
  const [inputMag, setInputMag] = useState('20');
  const [inputDeg, setInputDeg] = useState('0');
  
  // Estado para controlar se estamos editando uma harmônica existente
  const [isEditing, setIsEditing] = useState(false);

  // Adiciona ou atualiza uma harmônica na lista
  const handleSaveHarmonic = () => {
    const order = parseInt(inputOrder);
    const mag = parseFloat(inputMag) || 0;
    const deg = parseFloat(inputDeg) || 0;

    if (isNaN(order) || order < 1 || order > 50) {
      alert('A ordem harmônica deve ser um número inteiro entre 1 e 50.');
      return;
    }

    setHarmonics((prev) => {
      const filtered = prev.filter((h) => h.order !== order);
      return [...filtered, { order, mag, deg }].sort((a, b) => a.order - b.order);
    });

    // Reseta o estado do formulário
    setIsEditing(false);
    // Sugere a próxima harmônica ímpar comum após salvar
    if (!isEditing) {
      setInputOrder(prev => String(Math.min(parseInt(prev) + 2, 50)));
    }
  };

  // Carrega os dados da harmônica de volta para os inputs de edição
  const handleEditClick = (h) => {
    setInputOrder(String(h.order));
    setInputMag(String(h.mag));
    setInputDeg(String(h.deg));
    setIsEditing(true);
  };

  const handleRemoveHarmonic = (order) => {
    if (order === 1) {
      alert('A componente fundamental (Ordem 1) não pode ser removida. Edite seu valor se necessário.');
      return;
    }
    setHarmonics(harmonics.filter((h) => h.order !== order));
    if (isEditing && inputOrder === String(order)) {
      setIsEditing(false);
    }
  };

  // 1. CÁLCULO DOS ÍNDICES ELÉTRICOS (RMS, THD%, FATOR K)
  const metrics = useMemo(() => {
    let sumSquareTotal = 0;
    let sumSquareHarmonics = 0;
    let sumKFactorNumerator = 0;
    let v1 = 0;

    harmonics.forEach((h) => {
      const vRms = h.mag;
      sumSquareTotal += vRms * vRms;
      sumKFactorNumerator += Math.pow(h.order * vRms, 2);

      if (h.order === 1) {
        v1 = vRms;
      } else {
        sumSquareHarmonics += vRms * vRms;
      }
    });

    const totalRms = Math.sqrt(sumSquareTotal);
    const thd = v1 > 0 ? (Math.sqrt(sumSquareHarmonics) / v1) * 100 : 0;
    const kFactor = sumSquareTotal > 0 ? sumKFactorNumerator / sumSquareTotal : 1;

    return {
      v1,
      rms: totalRms.toFixed(2),
      thd: thd.toFixed(2),
      kFactor: kFactor.toFixed(3),
      maxPeak: (totalRms * Math.sqrt(2) * 1.3).toFixed(0) // Estimativa de teto para escala dinâmica linear do Y
    };
  }, [harmonics]);

  // 2. GERAÇÃO DOS PONTOS DA FORMA DE ONDA (3 Ciclos completos de 60Hz = 50ms)
  const chartData = useMemo(() => {
    const points = [];
    const pointsCount = 300; 
    const f = 60;
    const totalTime = 3 * (1 / f); 

    for (let i = 0; i <= pointsCount; i++) {
      const t = (i / pointsCount) * totalTime;
      let instantValue = 0;

      harmonics.forEach((h) => {
        const w = 2 * Math.PI * h.order * f;
        const radPhase = (h.deg * Math.PI) / 180;
        instantValue += (h.mag * Math.sqrt(2)) * Math.sin(w * t + radPhase);
      });

      points.push({
        time: parseFloat((t * 1000).toFixed(2)), 
        Valor: parseFloat(instantValue.toFixed(2))
      });
    }
    return points;
  }, [harmonics]);

  // 3. GERAÇÃO DOS DADOS DO HISTOGRAMA (Espectro completo de 1 a 50)
  const histogramData = useMemo(() => {
    const data = [];
    const v1 = metrics.v1 || 1; // Evita divisão por zero

    for (let o = 1; o <= 50; o++) {
      const active = harmonics.find((h) => h.order === o);
      const mag = active ? active.mag : 0;
      const percentage = (mag / v1) * 100;

      data.push({
        order: o,
        percentage: parseFloat(percentage.toFixed(2)),
        mag: mag
      });
    }
    return data;
  }, [harmonics, metrics.v1]);

  // Definição manual de eixos lineares perfeitamente espaçados
  const xTicks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const yMaxLimit = Math.max(parseInt(metrics.maxPeak), 100);

  // Ticks para o eixo X do Histograma (exibir de 5 em 5 para não poluir)
  const histogramXTicks = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <h2 style={{ textAlign: 'center', color: '#0f172a', marginBottom: '24px', fontWeight: 'bold' }}>ANALISADOR DE HARMÔNICAS</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1300px', margin: '0 auto' }}>
        
        {/* PARTE SUPERIOR: FORMULÁRIO, LISTA E GRÁFICO DE ONDA */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          
          {/* COLUNA DA ESQUERDA: ENTRADAS E LISTA */}
          <div style={{ flex: '1', minWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* PAINEL DE INSERÇÃO / EDIÇÃO */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: isEditing ? '2px solid #2563eb' : '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={18} color="#2563eb" /> 
                {isEditing ? 'Modificando Harmônica Ativa' : 'Configurar Componente Harmônica'}
              </h3>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Ordem (1-50)</label>
                  <input type="number" min="1" max="50" disabled={isEditing} value={inputOrder} onChange={(e) => setInputOrder(e.target.value)} style={{ padding: '8px', width: '70px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: isEditing ? '#f1f5f9' : '#fff', fontWeight: isEditing ? 'bold' : 'normal' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Módulo RMS (V)</label>
                  <input type="number" min="0" value={inputMag} onChange={(e) => setInputMag(e.target.value)} style={{ padding: '8px', width: '100px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Fase (Graus°)</label>
                  <input type="number" min="0" max="360" value={inputDeg} onChange={(e) => setInputDeg(e.target.value)} style={{ padding: '8px', width: '80px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
                
                <button onClick={handleSaveHarmonic} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: isEditing ? '#16a34a' : '#2563eb', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {isEditing ? <><Check size={16} /> Atualizar</> : <><Plus size={16} /> Inserir</>}
                </button>
              </div>
            </div>

            {/* LISTA DE HARMÔNICAS INSERIDAS */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', flex: 1, maxHeight: '205px', overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#475569', fontWeight: 'bold' }}>Espectro de Componentes Ativas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {harmonics.map((h) => (
                  <div key={h.order} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: h.order === 1 ? '#eff6ff' : '#f8fafc', borderRadius: '6px', borderLeft: h.order === 1 ? '4px solid #2563eb' : '4px solid #64748b' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      {h.order === 1 ? 'Fundamental (1ª)' : `${h.order}ª Harmônica`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#334155', fontFamily: 'monospace', marginRight: '4px' }}>
                        {h.mag} V RMS ∠ {h.deg}°
                      </span>
                      
                      {/* Botão de Editar */}
                      <button onClick={() => handleEditClick(h)} title="Editar parâmetro" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', color: '#475569' }}>
                        <Edit2 size={14} />
                      </button>

                      {/* Botão de Deletar */}
                      <button onClick={() => handleRemoveHarmonic(h.order)} disabled={h.order === 1} style={{ border: 'none', background: 'none', cursor: h.order === 1 ? 'not-allowed' : 'pointer', padding: '4px', color: h.order === 1 ? '#cbd5e1' : '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* COLUNA DA DIREITA: GRÁFICO E GRANDEZAS RESULTANTES */}
          <div style={{ flex: '2', minWidth: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* CARDS DE METRICAS RESULTANTES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', borderTop: '4px solid #0f172a' }}>
                <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>VALOR RMS TOTAL</span>
                <strong style={{ fontSize: '24px', color: '#0f172a' }}>{metrics.rms} <span style={{ fontSize: '14px' }}>V</span></strong>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', borderTop: '4px solid #dc2626' }}>
                <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>DISTORÇÃO (THD)</span>
                <strong style={{ fontSize: '24px', color: '#dc2626' }}>{metrics.thd} <span style={{ fontSize: '14px' }}>%</span></strong>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', borderTop: '4px solid #ea580c' }}>
                <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>FATOR K</span>
                <strong style={{ fontSize: '24px', color: '#ea580c' }}>{metrics.kFactor}</strong>
              </div>
            </div>

            {/* PLOT DA FORMA DE ONDA RESULTANTE */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', height: '315px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={18} color="#ea580c" /> Forma de Onda Resultante
              </h3>
              
              <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      type="number"
                      dataKey="time" 
                      scale="linear"
                      domain={[0, 50]}
                      ticks={xTicks}
                      stroke="#64748b"
                      label={{ value: 'Tempo (ms)', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <YAxis 
                      type="number"
                      scale="linear"
                      domain={[-yMaxLimit, yMaxLimit]}
                      tickCount={9} 
                      stroke="#64748b"
                      label={{ value: 'Amplitude (V)', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Tooltip formatter={(value) => [`${value} V`, 'Tensão Instantânea']} labelFormatter={(label) => `Tempo: ${label} ms`} />
                    <Line type="monotone" dataKey="Valor" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* PARTE INFERIOR: HISTOGRAMA DE ESPECTRO HARMÔNICO (1-50) */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', height: '280px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={18} color="#2563eb" /> Espectro de Frequências
          </h3>
          <div style={{ flex: 1, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="order" 
                  ticks={histogramXTicks}
                  stroke="#64748b"
                  label={{ value: 'Ordem Harmônica', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }}
                />
                <YAxis 
                  stroke="#64748b"
                  label={{ value: '% da Fundamental', angle: -90, position: 'insideBottomLeft', offset: 0, fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }}
                  unit="%"
                />
                <Tooltip 
                  formatter={(value, name, props) => {
                    if (name === "percentage") {
                      return [`${value}%`, 'Percentual'];
                    }
                    return [`${value} V RMS`, 'Módulo'];
                  }}
                  labelFormatter={(label) => `Ordem: ${label}ª`}
                />
                <Bar dataKey="percentage" name="percentage">
                  {histogramData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.order === 1 ? '#2563eb' : entry.percentage > 0 ? '#ef4444' : '#cbd5e1'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Harm;