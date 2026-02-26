# ZR Team — Plataforma de Jiu-Jitsu

App React + Vite para gestão de aulas, presenças e graduações de Jiu-Jitsu.

## Stack
- **Frontend**: Vite + React + TypeScript
- **Backend/DB**: Supabase (Auth + PostgreSQL)
- **Deploy**: Netlify

## Configuração Inicial

1. **Clonar e instalar**:
```bash
npm install
```

2. **Variáveis de ambiente** — Cria o ficheiro `.env.local` na raiz (copia de `.env.example`):
```
VITE_SUPABASE_URL=https://<teu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tua-anon-key>
```

3. **Base de Dados** — Corre o SQL em `database_schema.sql` no SQL Editor do Supabase.

4. **Funções RPC** — Corre o SQL em `supabase_rpc_and_edge_function.sql` para criar as funções `increment_attended_classes` e `decrement_attended_classes`.

5. **Edge Function NFC (ESP32)** — Ver as instruções comentadas em `supabase_rpc_and_edge_function.sql`.

6. **Desenvolvimento local**:
```bash
npm run dev
```

## Estrutura de Ficheiros
```
src/
├── components/
│   └── Layout.tsx          # Sidebar + Rotas protegidas
├── lib/
│   └── supabase.ts         # Cliente Supabase
└── pages/
    ├── Login.tsx            # Autenticação (Login + Registo)
    ├── Dashboard.tsx        # Dashboard Atleta & Admin
    ├── Classes.tsx          # Gestão de Aulas / Inscrição
    └── CheckIn.tsx          # Painel Check-in (NFC + Manual + Penalização)
```

## Roles e Permissões
| Role      | Acesso                                                    |
|-----------|-----------------------------------------------------------|
| Admin     | Tudo: criar/apagar aulas, check-in, ver todos os alunos   |
| Professor | Criar aulas, gerir check-in da aula atual                 |
| Atleta    | Ver dashboard, inscrever-se e desmarcar aulas             |

## Deploy Netlify
O ficheiro `netlify.toml` já está configurado. Basta ligar o repositório ao Netlify e adicionar as variáveis de ambiente.
