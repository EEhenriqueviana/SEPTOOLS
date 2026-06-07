import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';

// Constantes das curvas IEC e IEEE
const CURVE_TYPES = {
  IEC: {
    'Normal Inversa (A)': { k: 0.14, alpha: 0.02 },
    'Muito Inversa (B)': { k: 13.5, alpha: 1.0 },
    'Extremamente Inversa (C)': { k: 80.0, alpha: 2.0 },
    'Longa Inversa': { k: 120.0, alpha: 1.0 }
  },
  IEEE: {
    'Moderadamente Inversa': { k: 0.0515, alpha: 0.02, L: 0.114 },
    'Muito Inversa': { k: 19.61, alpha: 2.0, L: 0.491 },
    'Extremamente Inversa': { k: 28.2, alpha: 2.0, L: 0.1217 }
  }
};

function Coord() {
  const [elements, setElements] = useState([]);
  const [elementType, setElementType] = useState('curva');
  const [customName, setCustomName] = useState('');
  
  // Estados para Curvas
  const [curveStandard, setCurveStandard] = useState('IEC');
  const [selectedCurve, setSelectedCurve] = useState('Normal Inversa (A)');
  const [pickup, setPickup] = useState('100');
  const [dial, setDial] = useState('0.1');
  
  // Estados para Tempo Definido acoplado (ANSI 50)
  const [hasDefiniteTime, setHasDefiniteTime] = useState(false);
  const [dtPickup, setDtPickup] = useState('500');
  const [dtTime, setDtTime] = useState('0.05');

  // Estados para Ponto Isolado ou DT Puro
  const [time, setTime] = useState('0.5');
  const [pointCurrent, setPointCurrent] = useState('500');

  const handleStandardChange = (e) => {
    const std = e.target.value;
    setCurveStandard(std);
    if (std !== 'DT') {
      setSelectedCurve(Object.keys(CURVE_TYPES[std])[0]);
    }
  };

  const handleAddElement = () => {
    const id = Date.now();
    const pCurrent = parseFloat(pickup) || 1;
    
    let newElement = {
      id,
      type: elementType,
      pickup: pCurrent,
    };

    if (elementType === 'curva') {
      newElement.standard = curveStandard;
      
      if (curveStandard === 'DT') {
        newElement.time = parseFloat(time) || 0.1;
        newElement.name = customName.trim() || `DT (Iₚ:${pickup}A, t:${time}s)`;
      } else {
        newElement.dial = parseFloat(dial) || 0.1;
        newElement.curveParams = CURVE_TYPES[curveStandard][selectedCurve];
        
        // Configuração do Tempo Definido acoplado (ANSI 50)
        if (hasDefiniteTime) {
          newElement.hasDT = true;
          newElement.dtPickup = parseFloat(dtPickup) || 500;
          newElement.dtTime = parseFloat(dtTime) || 0.05;
          newElement.name = customName.trim() || `${curveStandard} - ${selectedCurve} + DT (Iₚ:${pickup}A)`;
        } else {
          newElement.name = customName.trim() || `${curveStandard} - ${selectedCurve} (Iₚ:${pickup}A)`;
        }
      }
    } else {
      newElement.current = parseFloat(pointCurrent) || 1;
      newElement.time = parseFloat(time) || 0.1;
      newElement.name = customName.trim() || `Ponto (I:${pointCurrent}A, t:${time}s)`;
    }

    setElements([...elements, newElement]);
    setCustomName(''); // Limpa o nome para o próximo elemento
  };

  const handleRemoveElement = (id) => {
    setElements(elements.filter(el => el.id !== id));
  };

  // Processamento matemático log-log
  const chartData = useMemo(() => {
    const points = [];
    for (let i = 10; i <= 20000; i = i * 1.05) {
      const current = Math.round(i);
      const dataPoint = { current };

      elements.forEach((el) => {
        if (el.type === 'curva') {
          if (el.standard === 'DT') {
            if (current >= el.pickup) {
              dataPoint[el.id] = el.time;
            }
          } else {
            const M = current / el.pickup;
            if (M > 1.02) {
              const { k, alpha, L = 0 } = el.curveParams;
              let t;
              
              if (el.standard === 'IEC') {
                t = el.dial * (k / (Math.pow(M, alpha) - 1));
              } else {
                t = el.dial * ((k / (Math.pow(M, alpha) - 1)) + L);
              }

              // Lógica de atuação do degrau de tempo definido (ANSI 50)
              if (el.hasDT && current >= el.dtPickup) {
                t = Math.min(t, el.dtTime);
              }

              if (t > 0.01 && t <= 100) {
                dataPoint[el.id] = parseFloat(t.toFixed(3));
              }
            }
          }
        }
      });

      if (Object.keys(dataPoint).length > 1) {
        points.push(dataPoint);
      }
    }
    return points;
  }, [elements]);

  const staticPoints = useMemo(() => {
    return elements.filter(el => el.type === 'ponto');
  }, [elements]);

  const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'];

  // Condição para renderizar o botão principal na linha superior ou inferior
  const showButtonInMainRow = elementType !== 'curva' || curveStandard === 'DT' || !hasDefiniteTime;

  // Renderizador do Botão Adicionar (Reutilizável)
  const renderAddButton = () => (
    <button 
      onClick={handleAddElement} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px', 
        backgroundColor: '#2563eb', 
        color: 'white', 
        border: 'none', 
        padding: '10px 18px', 
        borderRadius: '4px', 
        cursor: 'pointer', 
        fontWeight: 'bold',
        height: '40px'
      }}
    >
      <Plus size={18} /> Adicionar
    </button>
  );

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '24px', letterSpacing: '1px' }}>COORDENOGRAMA</h2>

      {/* FORMULÁRIO DE ENTRADA */}
      <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Tipo de Elemento</label>
            <select value={elementType} onChange={(e) => setElementType(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', height: '40px' }}>
              <option value="curva">Curva de Proteção</option>
              <option value="ponto">Ponto Isolado</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Nome do Elemento (Opcional)</label>
            <input type="text" placeholder="Ex: Relé Geral" value={customName} onChange={(e) => setCustomName(e.target.value)} style={{ padding: '8px', width: '200px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
          </div>

          {elementType === 'curva' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Padrão</label>
                <select value={curveStandard} onChange={handleStandardChange} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', height: '40px' }}>
                  <option value="IEC">IEC</option>
                  <option value="IEEE">IEEE</option>
                  <option value="DT">Tempo Definido Puro (DT)</option>
                </select>
              </div>

              {curveStandard !== 'DT' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Curva Tipo</label>
                  <select value={selectedCurve} onChange={(e) => setSelectedCurve(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', height: '40px' }}>
                    {Object.keys(CURVE_TYPES[curveStandard]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Pickup / Iₚ (A)</label>
                <input type="number" value={pickup} onChange={(e) => setPickup(e.target.value)} style={{ padding: '8px', width: '90px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
              </div>

              {curveStandard !== 'DT' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Dial de Tempo</label>
                  <input type="number" step="0.01" value={dial} onChange={(e) => setDial(e.target.value)} style={{ padding: '8px', width: '90px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Tempo (s)</label>
                  <input type="number" step="0.05" value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: '8px', width: '90px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
                </div>
              )}
            </>
          )}

          {elementType === 'ponto' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Corrente (A)</label>
                <input type="number" value={pointCurrent} onChange={(e) => setPointCurrent(e.target.value)} style={{ padding: '8px', width: '100px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Tempo (s)</label>
                <input type="number" step="0.01" value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: '8px', width: '100px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
              </div>
            </>
          )}

          {/* Renderiza o botão aqui APENAS se a ANSI 50 não estiver ativa */}
          {showButtonInMainRow && renderAddButton()}
        </div>

        {/* SEÇÃO DA ANSI 50 (TEMPO DEFINIDO ACOPLADO) */}
        {elementType === 'curva' && curveStandard !== 'DT' && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
              <input type="checkbox" checked={hasDefiniteTime} onChange={(e) => setHasDefiniteTime(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              Adicionar elemento de Tempo Definido acoplado (ANSI 50)
            </label>

            {hasDefiniteTime && (
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#64748b' }}>Corrente de Atuação ANSI 50 (A)</label>
                  <input type="number" value={dtPickup} onChange={(e) => setDtPickup(e.target.value)} style={{ padding: '8px', width: '120px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#64748b' }}>Tempo de Atuação ANSI 50 (s)</label>
                  <input type="number" step="0.01" value={dtTime} onChange={(e) => setDtTime(e.target.value)} style={{ padding: '8px', width: '100px', borderRadius: '4px', border: '1px solid #cbd5e1', height: '22px' }} />
                </div>
                
                {/* O botão "Adicionar" é renderizado aqui após os parâmetros da ANSI 50 */}
                {renderAddButton()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* LISTA DE ELEMENTOS ATIVOS */}
      {elements.length > 0 && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {elements.map((el, idx) => (
            <div key={el.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#e2e8f0', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', color: '#334155' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colors[idx % colors.length] }}></span>
              <strong>{el.name}</strong>
              <Trash2 size={14} color="#ef4444" style={{ cursor: 'pointer', marginLeft: '4px' }} onClick={() => handleRemoveElement(el.id)} />
            </div>
          ))}
        </div>
      )}

      {/* GRÁFICO LOG-LOG */}
      <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', height: '620px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            
            <XAxis 
              type="number" 
              dataKey="current" 
              scale="log" 
              domain={[10, 20000]} 
              allowDataOverflow 
              label={{ value: 'Corrente (A)', position: 'insideBottom', offset: -15, fill: '#475569', fontWeight: 'bold' }}
              tickFormatter={(val) => Math.round(val)}
              stroke="#64748b"
            />
            
            <YAxis 
              type="number" 
              scale="log" 
              domain={[0.01, 100]} 
              allowDataOverflow 
              label={{ value: 'Tempo de Atuação (s)', angle: -90, position: 'insideLeft', offset: -5, fill: '#475569', fontWeight: 'bold' }}
              tickFormatter={(val) => val}
              stroke="#64748b"
            />
            
            <Tooltip 
              formatter={(value) => [`${value} s`, 'Tempo']} 
              labelFormatter={(label) => `Corrente: ${label} A`}
              contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '6px' }}
            />
            <Legend verticalAlign="top" height={40}/>
            
            {elements.map((el, idx) => {
              if (el.type === 'curva') {
                return (
                  <Line
                    key={el.id}
                    type="monotone"
                    dataKey={el.id}
                    name={el.name}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                );
              }
              return null;
            })}

            {staticPoints.map((el) => (
              <ReferenceDot
                key={el.id}
                x={el.current}
                y={el.time}
                r={6}
                fill={colors[elements.indexOf(el) % colors.length]}
                stroke="#fff"
                strokeWidth={2}
                name={el.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Coord;