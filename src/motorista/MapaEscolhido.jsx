// Escolhe o mapa do motorista: Google (escuro) quando o servidor tem a chave
// e o Google aceita; senao, o da Esri. Se o Google recusar a chave depois de
// montar, troca para a Esri na hora.
import { useEffect, useState } from "react";
import MapaGoogle from "./MapaGoogle";
import MapaMotorista from "./MapaMotorista";
import { aoFalharGoogle, googleMaps } from "./googleMaps";

export default function MapaEscolhido(props) {
  // undefined = ainda decidindo; null = Esri; objeto = google.maps
  const [google, setGoogle] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    googleMaps().then((gm) => {
      if (vivo) setGoogle(gm);
    });
    const parar = aoFalharGoogle(() => {
      if (vivo) setGoogle(null);
    });
    return () => {
      vivo = false;
      parar();
    };
  }, []);

  if (google === undefined) return <div className="absolute inset-0" style={{ background: "#0b1210" }} />;
  if (google) return <MapaGoogle google={google} {...props} />;
  return <MapaMotorista {...props} />;
}
