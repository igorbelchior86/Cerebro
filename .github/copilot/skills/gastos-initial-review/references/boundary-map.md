# Boundary Map Checklist

## Inventário
- Listar targets/pacotes (SwiftPM) e sua intenção
- Identificar UI roots e navegação
- Identificar DI/composition root
- Identificar integrações (Firebase/Keychain/Notifications/etc.)

## Direção de dependência (ideal)
- UI/App -> Domain/Core
- UI/App -> Design
- Data -> Domain/Core
- Sync/Vendor -> Domain/Core
- Design -> Domain/Core
- Domain/Core -> (nada)

## Proibições comuns
- Vendor SDK em UI
- Domain/Core importando SwiftUI/UIKit
- UI instanciando services concretos sem protocolo
- Agregação pesada em SwiftUI `body`
