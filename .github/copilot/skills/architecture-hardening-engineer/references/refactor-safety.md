# Refactor Safety Rules

- Cada passo deve terminar com um estado consistente (compilável, idealmente testado).
- Se tocar dados do usuário, tratar como risco alto: exigir validação.
- Sem renomeações globais sem motivo.
- Se um passo tocar >10 arquivos, reavaliar e dividir.
- Sempre documentar rollback (reverter commit/PR).
