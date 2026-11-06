import Cabecalho from "../components/Cabecalho";
import ListaRecargas from "../components/ListaRecargas";

export default function Sessoes() {
  return (
    <div className="space-y-5 p-2 sm:p-4">
      <Cabecalho etiqueta="Operacao" titulo="Recargas" descricao="Recargas de todos os carregadores, com filtros e paginas." />
      <div className="app-panel p-2 sm:p-3">
        <ListaRecargas />
      </div>
    </div>
  );
}
