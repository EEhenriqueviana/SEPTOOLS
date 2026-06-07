import logo from "./assets/logo.svg";
import Menu from "./pages/menu"; // Geralmente componentes começam com letra maiúscula (Menu)
import Sim from "./pages/sim";
import Tc from "./pages/tc";
import Cc from "./pages/cc";
import Coord from "./pages/coord";
import Harm from "./pages/harm";

import { useState, useEffect } from "react";

function App() {
  // 1. Criamos o estado "paginaAtiva" e definimos o valor inicial como "menu"
  const [paginaAtiva, setPaginaAtiva] = useState("menu");

  // 2. Função para alterar a página atual
  const navegarPara = (pagina) => {
    setPaginaAtiva(pagina);
  };

  // 3. Função que renderiza o componente correto no Body baseado no estado
  const renderizarConteudo = () => {
    switch (paginaAtiva) {
      case "menu":
        return <Menu />;
      case "sim":
        return <Sim />;
      case "tc":
        return <Tc />;
      case "cc":
        return <Cc />;
      case "coord":
        return <Coord />;
      case "harm":
        return <Harm />;
      default:
        return <Menu />; // Caso dê algum erro, volta para o menu
    }
  };

  return (
    <div className="w-full min-h-screen bg-linear-to-r from-gray-400 to-white">
      <header className="flex justify-center items-center text-black py-6 px-8 md:px-24 bg-white drop-shadow-md z-50 relative">

        <div className="flex items-center gap-4">
          {/* Adicionado o onClick na logo para chamar o menu */}
          <a onClick={() => navegarPara("menu")} className="cursor-pointer">
            <img src={logo} alt="Logo" className="w-10 hover:scale-105 transition-all" />
          </a>
          {/* Alterado de "visao-geral" para "menu" no clique do título */}
          <h1 className="text-2xl font-bold cursor-pointer" onClick={() => navegarPara("menu")}>
            SEP TOOLS
          </h1>
        </div>
      </header>

      {/* O "Body" (agora <main>) executa a função que mostra o componente ativo */}
      <main className="p-8">
        {renderizarConteudo()}
      </main>

      <footer>
        <p className="text-center text-gray-500 text-sm py-4">© 2026 SEP TOOLS - Henrique Viana Bastos. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

export default App;