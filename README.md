# Sistemas P1 Auto Recife

Sistema interno em React para vendedores registrarem agendamentos e simulações, com painel separado para vendedores e visão geral para administração.

## Rodar localmente

```bash
npm install
npm run dev
```

## Firebase

O app já está configurado para o projeto `agendamentop1`, usando Firebase Authentication e Firestore.

O login da tela é feito com e-mail e senha. Crie os usuários em Authentication, no Firebase Console, com estes e-mails:

| Nome | E-mail |
| --- | --- |
| Thayenne Clemente | `thayanneclemente62@gmail.com` |
| Natalia Cassia | `nathy.kassia77@gmail.com` |
| Vinicius Ribeiro | `viniciusribeironetwork@gmail.com` |

As senhas devem ser definidas diretamente no Firebase Authentication. Por segurança, elas não ficam gravadas no código do projeto.

Quando o usuário entrar pela primeira vez, o sistema cria o perfil dele na coleção `p1_users`.

Para o login administrativo funcionar com permissão total, mantenha o usuário admin como `admin@p1autorecife.com.br` ou ajuste em dois lugares:

1. `VITE_ADMIN_EMAILS`, no arquivo `.env`, usando `.env.example` como base
2. A função `bootAdmin()` em `firestore.rules`

Depois publique as regras do Firestore pelo Firebase Console ou pela Firebase CLI.

## Coleções usadas

- `p1_users`
- `p1_appointments`
- `p1_simulations`
