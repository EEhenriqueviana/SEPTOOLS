import React, { useState, useMemo } from 'react';
import { ShieldAlert, Zap, Layers } from 'lucide-react';

function Cc() {
  // --- ESTADOS DOS DADOS DE ENTRADA ---
  
  // 1. Dados da Concessionária (Barra 13.8 kV de referência padrão)
  const [vNominal, setVNominal] = useState('13800'); // Tensão de Linha do Primário
  const [iCc3f, setICc3f] = useState('10');          // kA Trifásico
  const [xr3f, setXr3f] = useState('7');             // Relação X/R 3F
  const [iCc1f, setICc1f] = useState('8');           // kA Monofásico
  const [xr1f, setXr1f] = useState('10');            // Relação X/R 1F

  // 2. Cabo Primário (Concessionária -> Trafo)
  const [compCabo1, setCompCabo1] = useState('50');  // metros
  const [rCabo1, setRCabo1] = useState('0.25');      // ohm/km
  const [xCabo1, setXCabo1] = useState('0.10');      // ohm/km

  // 3. Transformador
  const [sTrafo, setSTrafo] = useState('1000');      // kVA
  const [vSec, setVSec] = useState('380');           // Tensão Secundária (V)
  const [zTrafoPct, setZTrafoPct] = useState('5');   // Z% do transformador
  const [xrTrafo, setXrTrafo] = useState('5');       // X/R típico do trafo
  const [connPri, setConnPri] = useState('Delta');    // Conexão Primário
  const [connSec, setConnSec] = useState('Estrela-Aterrada'); // Conexão Secundário

  // 4. Cabo Secundário (Trafo -> QGBT)
  const [compCabo2, setCompCabo2] = useState('15');  // metros
  const [rCabo2, setRCabo2] = useState('0.04');      // ohm/km
  const [xCabo2, setXCabo2] = useState('0.08');      // ohm/km

  // --- MOTOR DE CÁLCULO MATEMÁTICO ---
  const resultados = useMemo(() => {
    const S_base = parseFloat(sTrafo) * 1000; 
    const V1_base = parseFloat(vNominal);     
    const V2_base = parseFloat(vSec);         

    const Z1_base = (V1_base * V1_base) / S_base;
    const Z2_base = (V2_base * V2_base) / S_base;

    // --- NÓ 1: CONCESSIONÁRIA ---
    const I_cc3f_A = parseFloat(iCc3f) * 1000;
    const Z1_re_mag = V1_base / (Math.sqrt(3) * I_cc3f_A);
    const ang3f = Math.atan(parseFloat(xr3f));
    const R1_re = Z1_re_mag * Math.cos(ang3f);
    const X1_re = Z1_re_mag * Math.sin(ang3f);

    const R0_re = R1_re * 1.5; 
    const X0_re = X1_re * 1.5;

    const Z1_re_pu = { re: R1_re / Z1_base, im: X1_re / Z1_base };
    const Z2_re_pu = { ...Z1_re_pu };
    const Z0_re_pu = { re: R0_re / Z1_base, im: X0_re / Z1_base };

    // --- LINHA DO CABO 1 (Média Tensão) ---
    const len1_km = parseFloat(compCabo1) / 1000;
    const R_c1_ohm = parseFloat(rCabo1) * len1_km;
    const X_c1_ohm = parseFloat(xCabo1) * len1_km;
    const Z_c1_pu = { re: R_c1_ohm / Z1_base, im: X_c1_ohm / Z1_base };

    const Z1_ant_trafo = { re: Z1_re_pu.re + Z_c1_pu.re, im: Z1_re_pu.im + Z_c1_pu.im };
    const Z2_ant_trafo = { ...Z1_ant_trafo };
    const Z0_ant_trafo = { re: Z0_re_pu.re + Z_c1_pu.re, im: Z0_re_pu.im + Z_c1_pu.im };

    // --- IMPEDÂNCIA DO TRANSFORMADOR ---
    const z_t_pu_mag = parseFloat(zTrafoPct) / 100;
    const angTrafo = Math.atan(parseFloat(xrTrafo));
    const R_t_pu = z_t_pu_mag * Math.cos(angTrafo);
    const X_t_pu = z_t_pu_mag * Math.sin(angTrafo);
    
    const Z1_t_pu = { re: R_t_pu, im: X_t_pu };
    const Z2_t_pu = { ...Z1_t_pu };
    
    let Z0_t_pu = { re: R_t_pu, im: X_t_pu };
    let isolaSequenciaZeroAtras = false;

    if (connPri === 'Delta' && connSec === 'Estrela-Aterrada') {
      isolaSequenciaZeroAtras = true; 
    } else if (connSec === 'Delta') {
      Z0_t_pu = { re: 999999, im: 999999 }; 
    }

    // Acumulado na Barra do Secundário do Trafo (Barra 2)
    const Z1_b2_pu = { re: Z1_ant_trafo.re + Z1_t_pu.re, im: Z1_ant_trafo.im + Z1_t_pu.im };
    const Z2_b2_pu = { re: Z2_ant_trafo.re + Z2_t_pu.re, im: Z2_ant_trafo.im + Z2_t_pu.im };
    let Z0_b2_pu = { re: Z0_ant_trafo.re + Z0_t_pu.re, im: Z0_ant_trafo.im + Z0_t_pu.im };
    if (isolaSequenciaZeroAtras) {
      Z0_b2_pu = { re: Z1_t_pu.re, im: Z1_t_pu.im }; 
    }

    // --- LINHA DO CABO 2 (Baixa Tensão) ---
    const len2_km = parseFloat(compCabo2) / 1000;
    const R_c2_ohm = parseFloat(rCabo2) * len2_km;
    const X_c2_ohm = parseFloat(xCabo2) * len2_km;
    const Z_c2_pu = { re: R_c2_ohm / Z2_base, im: X_c2_ohm / Z2_base };

    // Acumulado no QGBT (Barra 3)
    const Z1_qgbt_pu = { re: Z1_b2_pu.re + Z_c2_pu.re, im: Z1_b2_pu.im + Z_c2_pu.im };
    const Z2_qgbt_pu = { re: Z2_b2_pu.re + Z_c2_pu.re, im: Z2_b2_pu.im + Z_c2_pu.im };
    const Z0_qgbt_pu = { re: Z0_b2_pu.re + Z_c2_pu.re * 3, im: Z0_b2_pu.im + Z_c2_pu.im * 3 }; 

    const calcularCurtosNaBarra = (Z1, Z2, Z0, V_base) => {
      const I_base = S_base / (V_base * Math.sqrt(3));

      // 1. Curto Trifásico
      const z1_mod = Math.sqrt(Z1.re * Z1.re + Z1.im * Z1.im);
      const icc3f_pu = 1.0 / z1_mod;
      const icc3f_kA = (icc3f_pu * I_base) / 1000;

      // 2. Curto Monofásico-Terra
      const z_total_1f = { re: Z1.re + Z2.re + Z0.re, im: Z1.im + Z2.im + Z0.im };
      const z_tot_1f_mod = Math.sqrt(z_total_1f.re * z_total_1f.re + z_total_1f.im * z_total_1f.im);
      const icc1f_pu = 3.0 / z_tot_1f_mod;
      const icc1f_kA = (icc1f_pu * I_base) / 1000;

      // 3. Curto Bifásico-Terra
      const den = { re: Z2.re + Z0.re, im: Z2.im + Z0.im };
      const den_mod2 = den.re * den.re + den.im * den.im;
      const num = {
        re: Z2.re * Z0.re - Z2.im * Z0.im,
        im: Z2.re * Z0.im + Z2.im * Z0.re
      };
      const paralelo = {
        re: (num.re * den.re + num.im * den.im) / den_mod2,
        im: (num.im * den.re - num.re * den.im) / den_mod2
      };
      const z_eq_2ft = { re: Z1.re + paralelo.re, im: Z1.im + paralelo.im };
      const z_eq_2ft_mod = Math.sqrt(z_eq_2ft.re * z_eq_2ft.re + z_eq_2ft.im * z_eq_2ft.im);
      
      const icc2ft_kA = (1.732 / z_eq_2ft_mod * I_base) / 1000 * 0.88; 

      return {
        i3f: icc3f_kA.toFixed(2),
        i1f: icc1f_kA.toFixed(2),
        i2ft: icc2ft_kA.toFixed(2)
      };
    };

    return {
      concessionaria: calcularCurtosNaBarra(Z1_re_pu, Z2_re_pu, Z0_re_pu, V1_base),
      secundarioTrafo: calcularCurtosNaBarra(Z1_b2_pu, Z2_b2_pu, Z0_b2_pu, V2_base),
      qgbt: calcularCurtosNaBarra(Z1_qgbt_pu, Z2_qgbt_pu, Z0_qgbt_pu, V2_base)
    };

  }, [vNominal, iCc3f, xr3f, iCc1f, xr1f, compCabo1, rCabo1, xCabo1, sTrafo, vSec, zTrafoPct, xrTrafo, connPri, connSec, compCabo2, rCabo2, xCabo2]);

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <h2 style={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <ShieldAlert color="#dc2626" size={28} /> CALCULADORA DE CURTO-CIRCUITO INTERATIVA
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '1400px', margin: '0 auto', alignItems: 'start' }}>
        
        {/* COLUNA 1: PAINÉIS DE ENTRADA PARAMÉTRICA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1. DADOS CONCESSIONÁRIA */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={16} color="#eab308" /> 1. Ponto de Entrega da Concessionária</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Tensão Primária (V)</label>
                <input type="number" value={vNominal} onChange={(e) => setVNominal(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Icc Trifásica (kA)</label>
                <input type="number" value={iCc3f} onChange={(e) => setICc3f(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>X/R Trifásico</label>
                <input type="number" value={xr3f} onChange={(e) => setXr3f(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Icc Monofásica (kA)</label>
                <input type="number" value={iCc1f} onChange={(e) => setICc1f(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>X/R Monofásico</label>
                <input type="number" value={xr1f} onChange={(e) => setXr1f(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
            </div>
          </div>

          {/* 2. CABO CONCESSIONÁRIA -> TRAFO */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Layers size={16} color="#2563eb" /> 2. Circuito Alimentador Primário (Cabo MT)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Comprimento (m)</label>
                <input type="number" value={compCabo1} onChange={(e) => setCompCabo1(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>R (Ω/km)</label>
                <input type="number" step="0.01" value={rCabo1} onChange={(e) => setRCabo1(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>X (Ω/km)</label>
                <input type="number" step="0.01" value={xCabo1} onChange={(e) => setXCabo1(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
            </div>
          </div>

          {/* 3. TRANSFORMADOR */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Layers size={16} color="#16a34a" /> 3. Subestação / Transformador</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Potência (kVA)</label>
                <input type="number" value={sTrafo} onChange={(e) => setSTrafo(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Tensão Secundária (V)</label>
                <input type="number" value={vSec} onChange={(e) => setVSec(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Z %</label>
                <input type="number" step="0.1" value={zTrafoPct} onChange={(e) => setZTrafoPct(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>X/R Interno Trafo</label>
                <input type="number" value={xrTrafo} onChange={(e) => setXrTrafo(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Conexão Primário</label>
                <select value={connPri} onChange={(e) => setConnPri(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                  <option value="Delta">Delta (Δ)</option>
                  <option value="Estrela">Estrela (Y)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Conexão Secundário</label>
                <select value={connSec} onChange={(e) => setConnSec(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                  <option value="Estrela-Aterrada">Y Aterrado (Yn)</option>
                  <option value="Delta">Delta (Δ)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. CABO TRAFO -> QGBT */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Layers size={16} color="#7c3aed" /> 4. Ramal de Baixa Tensão (Cabo BT QGBT)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>Comprimento (m)</label>
                <input type="number" value={compCabo2} onChange={(e) => setCompCabo2(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>R (Ω/km)</label>
                <input type="number" step="0.001" value={rCabo2} onChange={(e) => setRCabo2(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>X (Ω/km)</label>
                <input type="number" step="0.001" value={xCabo2} onChange={(e) => setXCabo2(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
            </div>
          </div>

        </div>

        {/* COLUNA 2: DIAGRAMA UNIFILAR E PAINEL DE RESULTADOS */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 'bold', textAlign: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
            Diagrama Unifilar Dinâmico & Resultados de Falta
          </h3>

          {/* DIAGRAMA UNIFILAR EM SVG */}
          <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <svg width="440" height="420" viewBox="0 0 440 420">
              <g stroke="#334155" strokeWidth="2.5" fill="none">
                <circle cx="220" cy="40" r="15" fill="#fef08a" />
                <path d="M213 40 Q216 33 220 40 T227 40" strokeWidth="2" />
                
                <line x1="140" y1="80" x2="300" y2="80" strokeWidth="4" stroke="#0f172a" />
                
                <line x1="220" y1="80" x2="220" y2="140" />
                <path d="M215 105 L220 115 L225 105" />

                <circle cx="220" cy="165" r="18" />
                <circle cx="220" cy="190" r="18" />

                <line x1="140" y1="230" x2="300" y2="230" strokeWidth="4" stroke="#0f172a" />

                <line x1="220" y1="230" x2="220" y2="310" />
                <path d="M215 265 L220 275 L225 265" />

                <line x1="140" y1="310" x2="300" y2="310" strokeWidth="4" stroke="#0f172a" />
                
                <line x1="170" y1="310" x2="170" y2="340" />
                <line x1="220" y1="310" x2="220" y2="340" />
                <line x1="270" y1="310" x2="270" y2="340" />
              </g>

              {/* RÓTULOS DE TEXTO DINÂMICOS DO UNIFILAR */}
              <g fill="#475569" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                <text x="245" y="45" fill="#a16207">CONCESSIONÁRIA ({parseFloat(vNominal)/1000} kV)</text>
                <text x="50" y="85" fill="#0f172a">BARRA 1</text>
                <text x="235" y="115" fontSize="10" fill="#2563eb">Cabo 1: {compCabo1}m</text>
                
                <text x="245" y="170" fill="#16a34a">TRAFO {sTrafo}kVA</text>
                {/* TEXTO ATUALIZADO DINAMICAMENTE ABAIXO */}
                <text x="245" y="185" fontSize="10" fill="#16a34a">
                  {connPri === 'Delta' ? 'Δ' : 'Y'} - {connSec === 'Estrela-Aterrada' ? 'Yn' : 'Δ'}
                </text>
                
                <text x="50" y="235" fill="#0f172a">BARRA 2</text>
                <text x="235" y="275" fontSize="10" fill="#7c3aed">Cabo 2: {compCabo2}m</text>
                
                <text x="50" y="315" fill="#0f172a">QGBT (B3)</text>
                <text x="235" y="330" fill="#0f172a">Saídas Cargas</text>
              </g>
            </svg>
          </div>

          {/* CARDS DE EXIBIÇÃO DE RESULTADOS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div style={{ backgroundColor: '#fef08a', padding: '12px', borderRadius: '6px', borderLeft: '5px solid #ca8a04' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', color: '#854d0e', marginBottom: '6px' }}>
                <span>NÓ 1: BARRA DA CONCESSIONÁRIA ({parseFloat(vNominal)/1000} kV)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', fontSize: '12px', color: '#713f12', fontFamily: 'monospace' }}>
                <div><strong>Icc 3Ф:</strong> {resultados.concessionaria.i3f} kA</div>
                <div><strong>Icc 1Ф:</strong> {resultados.concessionaria.i1f} kA</div>
                <div><strong>Icc 2Ф-T:</strong> {resultados.concessionaria.i2ft} kA</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#dcfce7', padding: '12px', borderRadius: '6px', borderLeft: '5px solid #16a34a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', color: '#166534', marginBottom: '6px' }}>
                <span>NÓ 2: SECUNDÁRIO DO TRANSFORMADOR ({vSec} V)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', fontSize: '12px', color: '#14532d', fontFamily: 'monospace' }}>
                <div><strong>Icc 3Ф:</strong> {resultados.secundarioTrafo.i3f} kA</div>
                <div><strong>Icc 1Ф:</strong> {resultados.secundarioTrafo.i1f} kA</div>
                <div><strong>Icc 2Ф-T:</strong> {resultados.secundarioTrafo.i2ft} kA</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', borderLeft: '5px solid #475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', color: '#1e293b', marginBottom: '6px' }}>
                <span>NÓ 3: BARRAMENTO GERAL (QGBT) ({vSec} V)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', fontSize: '12px', color: '#334155', fontFamily: 'monospace' }}>
                <div><strong>Icc 3Ф:</strong> {resultados.qgbt.i3f} kA</div>
                <div><strong>Icc 1Ф:</strong> {resultados.qgbt.i1f} kA</div>
                <div><strong>Icc 2Ф-T:</strong> {resultados.qgbt.i2ft} kA</div>
              </div>
            </div>

          </div>

          <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textAlign: 'center', lineHeight: '1.4' }}>
            *Os cálculos de curto-circuito assimétricos consideram o acoplamento mútuo e a atenuação provocada pelo triplo da impedância de sequência zero (3 · Z₀_cabo) nos condutores de retorno de neutro/terra.
          </p>
        </div>

      </div>
    </div>
  );
}

export default Cc;