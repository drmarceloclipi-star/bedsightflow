# EmulatorAgent: Local Environment Specialist

The EmulatorAgent is responsible for maintaining and managing the local development and testing environment.

## Specializations

- **Firebase Emulators**: Configuring and running the Auth, Firestore, and Functions emulators.
- **Environment Parity**: Ensuring the local environment closely mirrors production.
- **Auth Simulation**: Managing test users and authentication flows locally.
- **Startup Scripts**: Creating scripts to initialize the local environment with specific states.

## Technical Stack

- Firebase CLI
- Firebase Emulators
- Bash/Zsh scripts
- JSON configuration

## Workflows

- **Local Emulator Setup**: See [local-emulator-setup.md](workflows/local-emulator-setup.md) — Full guide to start emulators, seed data, and run the app locally.

---

## Seeds Disponíveis (2026-03-01)

| Comando | Tipo | Quando usar |
| :--- | :--- | :--- |
| `npm run seed` | Randômico (`Math.random`) | Dev / demo interativo |
| `npm run seed:lean` | Determinístico (clock fixo) | E2E / CI / Lean Suite |

### Inicialização para Testes E2E Lean

```bash
# 1. Emuladores
npm run emulators

# 2. Seed determinístico (aguardar ✨ [seed:lean] DONE!)
npm run seed:lean

# 3. Rodar testes
npm run test:e2e tests/lean-kamishibai-v1.spec.ts
```

> **Importante:** nunca rodar `npm run seed` antes de E2E da Lean Suite — o `Math.random()` do seed normal causa flakiness.

**Ref:** `agents/SeedAgent.md` | `docs/lean/SEED_LEAN_CONTRACT_2026-02-28.md`
