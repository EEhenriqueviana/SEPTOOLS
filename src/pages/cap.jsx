import React, { useState } from 'react';

function Cap() {
  // Estados para os dados de entrada principais
  const [tensao, setTensao] = useState(380); // Valor padrão de 380V
  const [fpAlvo, setFpAlvo] = useState(0.92); // Valor padrão de 0.92
  
  // Estado para a lista de cargas
  const [cargas, setCargas] = useState([
    { id: 1, nome: "Carga 1", potAtiva: 50, fp: 0.80, fd: 0.85 }
  ]);

  // Funções para gerenciar as cargas
  const adicionarCarga = () => {
    const novaCarga = {
      id: Date.now(),
      nome: `Carga ${cargas.length + 1}`,
      potAtiva: 0,
      fp: 1.0,
      fd: 1.0
    };
    setCargas([...cargas, novaCarga]);
  };

  const removerCarga = (id) => {
    setCargas(cargas.filter(carga => carga.id !== id));
  };

  const alterarCarga = (id, campo, valor) => {
    const novasCargas = cargas.map(carga => {
      if (carga.id === id) {
        return { ...carga, [campo]: parseFloat(valor) || 0 };
      }
      return carga;
    });
    setCargas(novasCargas);
  };

  // --- CÁLCULOS POR CARGA ---
  const cargasCalculadas = cargas.map(carga => {
    // Potência Ativa Demandada = Potência Ativa * Fator de Demanda
    const pDemandada = carga.potAtiva * carga.fd;
    
    // Se FP for 1, a reativa é 0 para evitar divisão por zero ou erros
    const angulo = carga.fp > 0 && carga.fp <= 1 ? Math.acos(carga.fp) : 0;
    const qDemandada = pDemandada * Math.tan(angulo);
    
    // Potência Aparente (S) = P / FP
    const sDemandada = carga.fp > 0 ? pDemandada / carga.fp : 0;
    
    // Corrente Nominal (I) trifásica = S / (V * sqrt(3))
    const corrente = tensao > 0 ? (sDemandada * 1000) / (tensao * Math.sqrt(3)) : 0;

    return {
      ...carga,
      pDemandada,
      qDemandada,
      sDemandada,
      corrente
    };
  });

  // --- TOTAIS ATUAIS ---
  const totalP = cargasCalculadas.reduce((acc, c) => acc + c.pDemandada, 0);
  const totalQ = cargasCalculadas.reduce((acc, c) => acc + c.qDemandada, 0);
  const totalS = Math.sqrt(Math.pow(totalP, 2) + Math.pow(totalQ, 2));
  const fpAtual = totalS > 0 ? totalP / totalS : 1;

  // --- CÁLCULOS DO BANCO DE CAPACITORES (ALVO) ---
  const anguloAlvo = fpAlvo > 0 && fpAlvo <= 1 ? Math.acos(fpAlvo) : 0;
  
  // Potência Reativa Final desejada
  const totalQFinal = totalP * Math.tan(anguloAlvo);
  
  // Potência Aparente Final desejada
  const totalSFinal = fpAlvo > 0 ? totalP / fpAlvo : 0;
  
  // Potência do Banco de Capacitores necessária (kVAr)
  // Se o FP atual já for maior ou igual ao alvo, não precisa de banco (0)
  const qBanco = totalQ > totalQFinal ? totalQ - totalQFinal : 0;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>Calculadora de Banco de Capacitores</h2>
      
      {/* Dados Gerais do Barramento */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tensão do Barramento (V):</label>
          <input 
            type="number" 
            value={tensao} 
            onChange={(e) => setTensao(Number(e.target.value))}
            style={{ padding: '8px', width: '150px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fator de Potência Alvo (ex: 0.92):</label>
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            max="1" 
            value={fpAlvo} 
            onChange={(e) => setFpAlvo(Number(e.target.value))}
            style={{ padding: '8px', width: '150px' }}
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
            <th style={{ padding: '10px' }}>Fator Potência (FP)</th>
            <th style={{ padding: '10px' }}>Fat. Demanda (FD)</th>
            <th style={{ padding: '10px' }}>Q Dem. (kVAr)</th>
            <th style={{ padding: '10px' }}>S Dem. (kVA)</th>
            <th style={{ padding: '10px' }}>Corrente (A)</th>
            <th style={{ padding: '10px' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {cargasCalculadas.map((carga) => (
            <tr key={carga.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '8px' }}>
                <input 
                  type="text" 
                  value={carga.nome} 
                  onChange={(e) => alterarCarga(carga.id, 'nome', e.target.value)}
                  style={{ width: '100px', padding: '4px' }}
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
              <td style={{ padding: '8px' }}>{carga.qDemandada.toFixed(2)}</td>
              <td style={{ padding: '8px' }}>{carga.sDemandada.toFixed(2)}</td>
              <td style={{ padding: '8px' }}>{carga.corrente.toFixed(2)}</td>
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
        
        {/* Totais Atuais */}
        <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', border: '1px solid #ffeeba' }}>
          <h4>Situação Atual (Instalação)</h4>
          <p><strong>Potência Ativa Total (P):</strong> {totalP.toFixed(2)} kW</p>
          <p><strong>Potência Reativa Total (Q):</strong> {totalQ.toFixed(2)} kVAr</p>
          <p><strong>Potência Aparente Total (S):</strong> {totalS.toFixed(2)} kVA</p>
          <p><strong>Fator de Potência Atual:</strong> {fpAtual.toFixed(2)}</p>
        </div>

        {/* Totais Após Correção / Banco */}
        <div style={{ backgroundColor: '#d4edda', padding: '20px', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
          <h4>Situação Corrigida (Alvo: {fpAlvo})</h4>
          <p><strong>Potência Ativa Final (P):</strong> {totalP.toFixed(2)} kW</p>
          <p><strong>Potência Reativa Final (Q):</strong> {totalQFinal.toFixed(2)} kVAr</p>
          <p><strong>Potência Aparente Final (S):</strong> {totalSFinal.toFixed(2)} kVA</p>
          <hr />
          <h3 style={{ color: '#155724', margin: '10px 0 0 0' }}>
            Dimensionamento do Banco:
          </h3>
          <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#155724' }}>
            {qBanco.toFixed(2)} kVAr (ou VAr: {(qBanco * 1000).toFixed(0)} VAr)
          </p>
        </div>

      </div>
    </div>
  );
}

export default Cap;