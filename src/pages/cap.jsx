import React, { useState } from 'react';

function Cap() {
  // Estados para os dados de entrada principais
  const [tensao, setTensao] = useState(380); // Valor padrão de 380V
  const [fpAlvo, setFpAlvo] = useState(0.92); // Fator de Potência Alvo (DPF)
  const [thdAlvo, setThdAlvo] = useState(5); // THD% Alvo (ex: 5%)
  
  // Estado para a lista de cargas
  const [cargas, setCargas] = useState([
    { id: 1, nome: "Carga 1", potAtiva: 50, fp: 0.80, fd: 0.85, thd: 20 }
  ]);

  // Funções para gerenciar as cargas
  const adicionarCarga = () => {
    const novaCarga = {
      id: Date.now(),
      nome: `Carga ${cargas.length + 1}`,
      potAtiva: 0,
      fp: 1.0,
      fd: 1.0,
      thd: 0 // Padrão 0%
    };
    setCargas([...cargas, novaCarga]);
  };

  const removerCarga = (id) => {
    setCargas(cargas.filter(carga => carga.id !== id));
  };

  const alterarCarga = (id, campo, valor) => {
    setCargas(cargas.map(carga => {
      if (carga.id === id) {
        // Se for o nome, mantém como String. Se for outro campo, converte para número.
        return { ...carga, [campo]: campo === 'nome' ? valor : (parseFloat(valor) || 0) };
      }
      return carga;
    }));
  };

  // --- CÁLCULOS POR CARGA ---
  const cargasCalculadas = cargas.map(carga => {
    const pDemandada = carga.potAtiva * carga.fd;
    
    // Aqui o FP informado é tratado como DPF (frequência fundamental)
    const angulo = carga.fp > 0 && carga.fp <= 1 ? Math.acos(carga.fp) : 0;
    const qDemandada = pDemandada * Math.tan(angulo);
    
    // Potência Aparente Fundamental (S1)
    const sFundamental = carga.fp > 0 ? pDemandada / carga.fp : 0;
    
    // Corrente Fundamental Eficaz (I1) trifásica
    const iFundamental = tensao > 0 ? (sFundamental * 1000) / (tensao * Math.sqrt(3)) : 0;
    
    // Corrente Harmônica da carga (Ih = I1 * THD%)
    const iHarmonica = iFundamental * (carga.thd / 100);
    
    // Corrente Total RMS da carga (I rms = sqrt(I1² + Ih²))
    const iTotalRms = Math.sqrt(Math.pow(iFundamental, 2) + Math.pow(iHarmonica, 2));

    return {
      ...carga,
      pDemandada,
      qDemandada,
      sFundamental,
      iFundamental,
      iHarmonica,
      iTotalRms
    };
  });

  // --- TOTAIS ATUAIS DA INSTALAÇÃO ---
  const totalP = cargasCalculadas.reduce((acc, c) => acc + c.pDemandada, 0);
  const totalQ1 = cargasCalculadas.reduce((acc, c) => acc + c.qDemandada, 0); // Reativa Fundamental
  const totalS1 = Math.sqrt(Math.pow(totalP, 2) + Math.pow(totalQ1, 2)); // Aparente Fundamental
  
  // Corrente Fundamental Total da Instalação
  const totalI1 = tensao > 0 ? (totalS1 * 1000) / (tensao * Math.sqrt(3)) : 0;
  
  // Corrente Harmônica Total (raiz da soma dos quadrados das correntes harmônicas)
  const totalIh = Math.sqrt(cargasCalculadas.reduce((acc, c) => acc + Math.pow(c.iHarmonica, 2), 0));
  
  // Corrente RMS Total da instalação
  const totalIrms = Math.sqrt(Math.pow(totalI1, 2) + Math.pow(totalIh, 2));
  
  // Potência Aparente Total (S) considerando harmônicas
  const totalS = tensao > 0 ? (totalIrms * tensao * Math.sqrt(3)) / 1000 : 0;

  // Fatores de Potência Atuais
  const dpfAtual = totalS1 > 0 ? totalP / totalS1 : 1; // Fator de deslocamento (fundamental)
  const tpfAtual = totalS > 0 ? totalP / totalS : 1;   // Fator de potência total (com harmônicas)

  // --- CÁLCULOS DO BANCO DE CAPACITORES (Apenas DPF) ---
  const anguloAlvo = fpAlvo > 0 && fpAlvo <= 1 ? Math.acos(fpAlvo) : 0;
  const totalQFinalBco = totalP * Math.tan(anguloAlvo);
  const qBancoVAr = totalQ1 > totalQFinalBco ? (totalQ1 - totalQFinalBco) * 1000 : 0;

  // --- CÁLCULOS DO FILTRO ATIVO (DPF + TPF/Harmônicas) ---
  // 1. Corrente reativa fundamental atual que precisa ser compensada para atingir o DPF Alvo
  const i1ReativaAtual = totalI1 * Math.sin(Math.acos(dpfAtual));
  const i1ReativaAlvo = totalI1 * Math.sin(anguloAlvo);
  const iFiltroFundamental = i1ReativaAtual > i1ReativaAlvo ? (i1ReativaAtual - i1ReativaAlvo) : 0;

  // 2. Corrente harmônica máxima permitida após filtragem baseada no THD Alvo
  const totalIhAlvo = totalI1 * (thdAlvo / 100);
  // Corrente harmônica que o filtro precisa mitigar/eliminar
  const iFiltroHarmonica = totalIh > totalIhAlvo ? Math.sqrt(Math.pow(totalIh, 2) - Math.pow(totalIhAlvo, 2)) : 0;

  // 3. Capacidade Total em Corrente do Filtro Ativo (Soma vetorial da compensação de DPF + Harmônicas)
  const iFiltroAtivoTotal = Math.sqrt(Math.pow(iFiltroFundamental, 2) + Math.pow(iFiltroHarmonica, 2));

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
      <h2>Calculadora de Banco de Capacitores vs Filtro Ativo</h2>
      
      {/* Dados Gerais do Barramento e Alvos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '20px', backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tensão do Barramento (V):</label>
          <input 
            type="number" 
            value={tensao} 
            onChange={(e) => setTensao(Number(e.target.value))}
            style={{ padding: '8px', width: '130px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>DPF Alvo (ex: 0.92):</label>
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            max="1" 
            value={fpAlvo} 
            onChange={(e) => setFpAlvo(Number(e.target.value))}
            style={{ padding: '8px', width: '130px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>THD Alvo (%):</label>
          <input 
            type="number" 
            min="0" 
            max="100" 
            value={thdAlvo} 
            onChange={(e) => setThdAlvo(Number(e.target.value))}
            style={{ padding: '8px', width: '130px' }}
          />
        </div>
      </div>

      {/* Seção de Lista de Cargas */}
      <h3>Lista de Cargas</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#007bff', color: 'white', textAlign: 'left' }}>
            <th style={{ padding: '10px' }}>Nome da Carga</th>
            <th style={{ padding: '10px' }}>Pot. Ativa (kW)</th>
            <th style={{ padding: '10px' }}>DPF (FP)</th>
            <th style={{ padding: '10px' }}>Fat. Demanda (FD)</th>
            <th style={{ padding: '10px' }}>THD (%)</th>
            <th style={{ padding: '10px' }}>I Fund. (A)</th>
            <th style={{ padding: '10px' }}>I Harm. (A)</th>
            <th style={{ padding: '10px' }}>I RMS (A)</th>
            <th style={{ padding: '10px' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {cargasCalculadas.map((carga) => (
            <tr key={carga.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '8px' }}>
                <input 
                  type="text" // CORRIGIDO: Agora aceita estritamente texto
                  value={carga.nome} 
                  onChange={(e) => alterarCarga(carga.id, 'nome', e.target.value)}
                  style={{ width: '120px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '8px' }}>
                <input 
                  type="number" 
                  value={carga.potAtiva} 
                  onChange={(e) => alterarCarga(carga.id, 'potAtiva', e.target.value)}
                  style={{ width: '80px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '8px' }}>
                <input 
                  type="number" 
                  step="0.01" 
                  value={carga.fp} 
                  onChange={(e) => alterarCarga(carga.id, 'fp', e.target.value)}
                  style={{ width: '70px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '8px' }}>
                <input 
                  type="number" 
                  step="0.1" 
                  value={carga.fd} 
                  onChange={(e) => alterarCarga(carga.id, 'fd', e.target.value)}
                  style={{ width: '70px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '8px' }}>
                <input 
                  type="number" 
                  value={carga.thd} 
                  onChange={(e) => alterarCarga(carga.id, 'thd', e.target.value)}
                  style={{ width: '70px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '8px' }}>{carga.iFundamental.toFixed(2)}</td>
              <td style={{ padding: '8px' }}>{carga.iHarmonica.toFixed(2)}</td>
              <td style={{ padding: '8px' }}>{carga.iTotalRms.toFixed(2)}</td>
              <td style={{ padding: '8px' }}>
                <button 
                  onClick={() => removerCarga(carga.id)} 
                  style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button 
        onClick={adicionarCarga} 
        style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', marginBottom: '30px' }}
      >
        + Adicionar Carga
      </button>

      <hr />

      {/* Bloco de Resultados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        
        {/* Situação Atual */}
        <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', border: '1px solid #ffeeba' }}>
          <h4>Situação Atual da Instalação</h4>
          <p><strong>Potência Ativa Total (P):</strong> {totalP.toFixed(2)} kW</p>
          <p><strong>Potência Aparente Total (S):</strong> {totalS.toFixed(2)} kVA</p>
          <p><strong>Fator de Potência de Deslocamento (DPF):</strong> {dpfAtual.toFixed(2)}</p>
          <p><strong>Fator de Potência Total (TPF):</strong> {tpfAtual.toFixed(2)}</p>
          <hr />
          <p><strong>Corrente Fundamental Total ($I_1$):</strong> {totalI1.toFixed(2)} A</p>
          <p style={{ color: '#b91c1c', fontWeight: 'bold' }}>
            Corrente Harmônica Total ($I_h$): {totalIh.toFixed(2)} A
          </p>
          <p><strong>Corrente RMS Total (I RMS):</strong> {totalIrms.toFixed(2)} A</p>
        </div>

        {/* Soluções de Correção */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Opção 1: Banco de Capacitores */}
          <div style={{ backgroundColor: '#e0f2fe', padding: '15px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#0369a1' }}>Opção A: Banco de Capacitores</h4>
            <small style={{ color: '#0369a1' }}>Corrige apenas o DPF (Frequência Fundamental)</small>
            <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#0369a1', margin: '10px 0 0 0' }}>
              Potência Necessária: {qBancoVAr.toFixed(0)} VAr ({ (qBancoVAr/1000).toFixed(2) } kVAr)
            </p>
          </div>

          {/* Opção 2: Filtro Ativo */}
          <div style={{ backgroundColor: '#d4edda', padding: '15px', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#155724' }}>Opção B: Filtro Ativo de Harmônicas</h4>
            <small style={{ color: '#155724' }}>Corrige o DPF, mitiga Harmônicas e melhora o TPF</small>
            <p style={{ margin: '10px 0 5px 0' }}>Compensação DPF: {iFiltroFundamental.toFixed(2)} A</p>
            <p style={{ margin: '0 0 10px 0' }}>Atenuação Harmônica (Alvo {thdAlvo}%): {iFiltroHarmonica.toFixed(2)} A</p>
            <hr />
            <h3 style={{ color: '#155724', margin: '5px 0 0 0' }}>Corrente Nominal do Filtro Ativo:</h3>
            <p style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#155724', margin: '5px 0 0 0' }}>
              {iFiltroAtivoTotal.toFixed(2)} A
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

export default Cap;