# Ruleset (IDs e critérios)

Cada regra gera:
- pass
- fail
- insufficient_data
- warning

## Tipografia
- TYP-001 MajorThirdScale
- TYP-002 TooManyTextStyles
- TYP-003 TrackingDirection

## Espaçamento e ritmo
- SPC-001 NonRhythmicVerticalGaps
- SPC-002 InconsistentHorizontalPadding

## Layout (keylines e alinhamento)
- LAY-001 Keylines4ColumnSystem
  - NÃO audita número de colunas do layout.
  - Audita consistência de keylines/margens e alinhamento interno.
  - Falha se houver achados de desalinhamento recorrentes (offsets) com confiança alta.
  - Insufficient_data se faltarem dados de padding/alinhamento.
- LAY-002 AlignmentFindingsHigh
  - Falha se houver achado de alinhamento com severity_hint=high.

## Cores
- COL-001 TooManyDistinctColors
- COL-002 AccentShareTooHigh
- COL-003 ContrastRiskHints

## CTA
- CTA-001 NoPrimaryCTA
- CTA-002 TooManyCompetingCTAs
- CTA-003 PrimaryCTABelowFold
