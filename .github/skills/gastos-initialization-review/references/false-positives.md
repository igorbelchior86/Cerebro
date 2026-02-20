# False Positives (Startup)

- Código acionado apenas por widget/extension
- Side-effects condicionais por feature flags
- Decoding/migrations necessários no primeiro-run
- `onAppear`/`.task` reexecutando por ciclo de vida normal (precisa guard, não “bug” por si só)
