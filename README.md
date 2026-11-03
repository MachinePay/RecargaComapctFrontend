# CompactPay Recarga - site

Um site React so com duas partes:
- `/totem`: tela do motorista, aberta no tablet;
- o painel do administrador: Dashboard, Carregadores, Recargas, Tablets e Diagnostico.

Usa React, Vite, Tailwind, react-router, axios e sweetalert2, no mesmo
padrao e tema do frontend CompactPay.

## Rodar local

```bash
npm install
cp .env.example .env    # VITE_API_URL=/api/v1 (o Vite encaminha para o backend em :8000)
npm run dev             # http://localhost:5173
```

## Deploy na Vercel

1. Vercel > **Add New > Project** > importe este repositorio. O framework
   (Vite) e' detectado sozinho.
2. Em **Environment Variables**, crie `VITE_API_URL` com a URL do backend +
   `/api/v1`, ex.: `https://compactpay-recarga-api.onrender.com/api/v1`.
3. **Deploy**. O `vercel.json` ja cuida das rotas do React.
4. Coloque a URL do site em `CORS_ALLOWED_ORIGINS` no backend (Render).

Se mudar o `VITE_API_URL` depois, faca um **Redeploy**: a variavel entra no build.

Login do painel: a `ADMIN_API_KEY` do backend. A tela **Diagnostico** mostra
o que colocar no app do carregador e testa a conexao ao vivo.
