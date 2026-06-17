import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Info } from 'lucide-react';

// Constantes Geométricas para o SVG
const SIZE = 500;
const CENTER = SIZE / 2;
const MAX_MAGNITUDE = 100; // Valor máximo nominal do fasor
const RADIUS = CENTER - 40; // Raio máximo em pixels no SVG

// Funções Auxiliares de Conversão Matemática
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

const polarToCartesian = (mag, deg) => {
  const rad = toRad(deg);
  // Inversão do eixo Y para adequação ao plano complexo no padrão SVG
  const x = CENTER + (mag / MAX_MAGNITUDE) * RADIUS * Math.cos(rad);
  const y = CENTER - (mag / MAX_MAGNITUDE) * RADIUS * Math.sin(rad);
  return { x, y };
};

const cartesianToPolar = (x, y) => {
  const dx = x - CENTER;
  const dy = CENTER - y;
  let mag = (Math.sqrt(dx * dx + dy * dy) / RADIUS) * MAX_MAGNITUDE;
  if (mag > MAX_MAGNITUDE) mag = MAX_MAGNITUDE;

  let deg = toDeg(Math.atan2(dy, dx));
  if (deg < 0) deg += 360;

  return { mag: parseFloat(mag.toFixed(1)), deg: parseFloat(deg.toFixed(1)) };
};

// Operações com Números Complexos para Componentes Simétricas
const complexFromPolar = (mag, deg) => {
  const rad = toRad(deg);
  return { re: mag * Math.cos(rad), im: mag * Math.sin(rad) };
};

const complexToPolar = (c) => {
  let mag = Math.sqrt(c.re * c.re + c.im * c.im);
  let deg = toDeg(Math.atan2(c.im, c.re));
  if (deg < 0) deg += 360;
  return { mag: parseFloat(mag.toFixed(1)), deg: parseFloat(deg.toFixed(1)) };
};

const addComplex = (...nums) => nums.reduce((acc, n) => ({ re: acc.re + n.re, im: acc.im + n.im }), { re: 0, im: 0 });
const multiplyComplex = (c1, c2) => ({
  re: c1.re * c2.re - c1.im * c2.im,
  im: c1.re * c2.im + c1.im * c2.re
});
const scaleComplex = (c, factor) => ({ re: c.re * factor, im: c.im * factor });

const ALPHA = complexFromPolar(1, 120);
const ALPHA2 = complexFromPolar(1, 240);

function Sim() {
  // Estado dos Fasores de Entrada (Fases A, B e C)
  const [fasores, setFasores] = useState({
    A: { mag: 80, deg: 0 },
    B: { mag: 80, deg: 240 },
    C: { mag: 80, deg: 120 },
  });

  const [activePhasor, setActivePhasor] = useState(null);
  const svgRef = useRef(null);

  // Recalcula as Componentes Simétricas (Fortescue)
  const componentes = React.useMemo(() => {
    const a = complexFromPolar(fasores.A.mag, fasores.A.deg);
    const b = complexFromPolar(fasores.B.mag, fasores.B.deg);
    const c = complexFromPolar(fasores.C.mag, fasores.C.deg);

    const v0 = scaleComplex(addComplex(a, b, c), 1 / 3);
    const v1 = scaleComplex(addComplex(a, multiplyComplex(ALPHA, b), multiplyComplex(ALPHA2, c)), 1 / 3);
    const v2 = scaleComplex(addComplex(a, multiplyComplex(ALPHA2, b), multiplyComplex(ALPHA, c)), 1 / 3);

    return {
      zero: complexToPolar(v0),
      pos: complexToPolar(v1),
      neg: complexToPolar(v2),
    };
  }, [fasores]);

  // Manipulação unificada para Inputs Numéricos e Sliders
  const handleInputChange = (phase, field, value) => {
    let numValue = parseFloat(value);
    if (isNaN(numValue)) numValue = 0;

    if (field === 'mag') {
      if (numValue > MAX_MAGNITUDE) numValue = MAX_MAGNITUDE;
      if (numValue < 0) numValue = 0;
    } else if (field === 'deg') {
      if (numValue < 0) numValue = (numValue % 360) + 360;
      if (numValue > 360) numValue = numValue % 360;
    }

    setFasores((prev) => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [field]: parseFloat(numValue.toFixed(1)),
      },
    }));
  };

  // Eventos do Mouse/Touch para arrastar a ponta do vetor no SVG
  const handleMouseDown = (phasorKey) => (e) => {
    e.preventDefault();
    setActivePhasor(phasorKey);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!activePhasor || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const svgX = (x / rect.width) * SIZE;
      const svgY = (y / rect.height) * SIZE;

      const newPolar = cartesianToPolar(svgX, svgY);

      setFasores((prev) => ({
        ...prev,
        [activePhasor]: newPolar,
      }));
    };

    const handleMouseUp = () => {
      setActivePhasor(null);
    };

    if (activePhasor) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [activePhasor]);

  const resetFasores = () => {
    setFasores({
      A: { mag: 80, deg: 0 },
      B: { mag: 80, deg: 240 },
      C: { mag: 80, deg: 120 },
    });
  };

  // Coordenadas cartesianas dos fasores de fase
  const posA = polarToCartesian(fasores.A.mag, fasores.A.deg);
  const posB = polarToCartesian(fasores.B.mag, fasores.B.deg);
  const posC = polarToCartesian(fasores.C.mag, fasores.C.deg);

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ color: '#0f172a', marginBottom: '4px', fontWeight: 'bold' }}>ANÁLISE DE COMPONENTES SIMÉTRICAS</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Info size={16} /> Altere os valores **digitando**, usando as **barras** ou **arrastando** as pontas dos fasores no gráfico.
      </p>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '1100px', width: '100%' }}>
        
        {/* GRÁFICO POLAR VETORIAL (APENAS FASORES DE FASE) */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            ref={svgRef}
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fafafa', cursor: activePhasor ? 'grabbing' : 'default' }}
          >
            {/* Definição das pontas das setas */}
            <defs>
              <marker id="arrowA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626" /></marker>
              <marker id="arrowB" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#2563eb" /></marker>
              <marker id="arrowC" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#16a34a" /></marker>
            </defs>

            {/* Círculos Concêntricos de Grade Polar */}
            {[25, 50, 75, 100].map((val) => (
              <circle
                key={val}
                cx={CENTER}
                cy={CENTER}
                r={(val / MAX_MAGNITUDE) * RADIUS}
                fill="none"
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
            ))}

            {/* Linhas de Eixos Angulares */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
              const rad = toRad(angle);
              const x2 = CENTER + RADIUS * Math.cos(rad);
              const y2 = CENTER - RADIUS * Math.sin(rad);
              return (
                <line
                  key={angle}
                  x1={CENTER}
                  y1={CENTER}
                  x2={x2}
                  y2={y2}
                  stroke={angle % 90 === 0 ? '#cbd5e1' : '#f1f5f9'}
                  strokeWidth={angle % 90 === 0 ? 1.5 : 1}
                />
              );
            })}

            {/* Textos de Graus da Grade */}
            <text x={CENTER + RADIUS + 8} y={CENTER + 4} fontSize="12" fill="#94a3b8" fontWeight="bold">0°</text>
            <text x={CENTER - 10} y={CENTER - RADIUS - 8} fontSize="12" fill="#94a3b8" fontWeight="bold">90°</text>
            <text x={CENTER - RADIUS - 32} y={CENTER + 4} fontSize="12" fill="#94a3b8" fontWeight="bold">180°</text>
            <text x={CENTER - 15} y={CENTER + RADIUS + 16} fontSize="12" fill="#94a3b8" fontWeight="bold">270°</text>

            {/* FASORES PRINCIPAIS DE FASE */}
            <line x1={CENTER} y1={CENTER} x2={posA.x} y2={posA.y} stroke="#dc2626" strokeWidth={4} markerEnd="url(#arrowA)" />
            <line x1={CENTER} y1={CENTER} x2={posB.x} y2={posB.y} stroke="#2563eb" strokeWidth={4} markerEnd="url(#arrowB)" />
            <line x1={CENTER} y1={CENTER} x2={posC.x} y2={posC.y} stroke="#16a34a" strokeWidth={4} markerEnd="url(#arrowC)" />

            {/* Nós de Arrasto Interativos */}
            <circle cx={posA.x} cy={posA.y} r={8} fill="#dc2626" stroke="#fff" strokeWidth={2} style={{ cursor: 'grab' }} onMouseDown={handleMouseDown('A')} onTouchStart={handleMouseDown('A')} />
            <circle cx={posB.x} cy={posB.y} r={8} fill="#2563eb" stroke="#fff" strokeWidth={2} style={{ cursor: 'grab' }} onMouseDown={handleMouseDown('B')} onTouchStart={handleMouseDown('B')} />
            <circle cx={posC.x} cy={posC.y} r={8} fill="#16a34a" stroke="#fff" strokeWidth={2} style={{ cursor: 'grab' }} onMouseDown={handleMouseDown('C')} onTouchStart={handleMouseDown('C')} />
          </svg>
        </div>

        {/* CONTROLES NUMÉRICOS COM INPUT DIRETO */}
        <div style={{ flex: '1', minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* PAINEL DE AJUSTES DOS FASORES */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#334155', fontWeight: 'bold' }}>Ajuste dos Fasores de Fase</h3>
              <button onClick={resetFasores} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 10px', borderRadius: '4px', backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                <RefreshCw size={12} /> Reset Equilibrado
              </button>
            </div>

            {['A', 'B', 'C'].map((phase) => {
              const colors = { A: '#dc2626', B: '#2563eb', C: '#16a34b' };
              return (
                <div key={phase} style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: phase !== 'C' ? '1px dashed #f1f5f9' : 'none' }}>
                  
                  {/* Cabeçalho da Fase com Inputs Numéricos Diretos */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: colors[phase] }}>Fase V_{phase}</span>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Input de Módulo */}
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        step="0.1"
                        value={fasores[phase].mag} 
                        onChange={(e) => handleInputChange(phase, 'mag', e.target.value)}
                        style={{ width: '65px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>V  ∠</span>
                      
                      {/* Input de Ângulo */}
                      <input 
                        type="number" 
                        min="0" 
                        max="360" 
                        step="0.1"
                        value={fasores[phase].deg} 
                        onChange={(e) => handleInputChange(phase, 'deg', e.target.value)}
                        style={{ width: '65px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>°</span>
                    </div>
                  </div>

                  {/* Sliders de Apoio Visual Corrigidos */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="0.5" 
                        value={fasores[phase].mag} 
                        onChange={(e) => handleInputChange(phase, 'mag', e.target.value)} 
                        style={{ width: '100%', accentColor: colors[phase] }} 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="360" 
                        step="0.5" 
                        value={fasores[phase].deg} 
                        onChange={(e) => handleInputChange(phase, 'deg', e.target.value)} 
                        style={{ width: '100%', accentColor: colors[phase] }} 
                      />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* MATRIZ DE COMPONENTES SIMÉTRICAS RESULTANTES */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', flex: 1 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#334155', fontWeight: 'bold', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>Componentes Simétricas Calculadas</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '8px', backgroundColor: '#f8f5ff', borderLeft: '4px solid #7c3aed' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6d28d9' }}>Sequência Positiva (V₁)</span>
                  <span style={{ fontSize: '11px', color: '#9333ea' }}></span>
                </div>
                <strong style={{ fontSize: '16px', color: '#5b21b6' }}>{componentes.pos.mag} V ∠ {componentes.pos.deg}°</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '8px', backgroundColor: '#fff7ed', borderLeft: '4px solid #ea580c' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#c2410c' }}>Sequência Negativa (V₂)</span>
                  <span style={{ fontSize: '11px', color: '#ea580c' }}></span>
                </div>
                <strong style={{ fontSize: '16px', color: '#9a3412' }}>{componentes.neg.mag} V ∠ {componentes.neg.deg}°</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', borderLeft: '4px solid #475569' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Sequência Zero (V₀)</span>
                  <span style={{ fontSize: '11px', color: '#475569' }}></span>
                </div>
                <strong style={{ fontSize: '16px', color: '#1e293b' }}>{componentes.zero.mag} V ∠ {componentes.zero.deg}°</strong>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Sim;