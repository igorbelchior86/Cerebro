# Audit Report

## Meta

- Screen: Home Dashboard 2026

- Platform: iOS

- Device: iPhone com Dynamic Island (~iPhone 15 Pro)

- Mode: dark

- Images: user screenshot 1 (dashboard overview), user screenshot 2 (month-detail expansion)


## Summary

- Total findings: 13

- High: 0

- Medium: 1

- Low: 8

- Insufficient data: 4


## Findings (ordered)

### COL-003 [warning] (medium)

- Description: Há indícios de risco de contraste reportados.

- Evidence: contrast_risk_hints=[{'description': "Textos secundários em cinza claro (ex: '53 transações') sobre cards escuros podem ter contraste próximo ao mínimo", 'confidence': 0.4, 'evidence': 'O cinza usado é visivelmente mais próximo do fundo do que o branco'}]

- Recommendation: Aumentar contraste e validar legibilidade.

- Code search hints: foregroundColor, opacity(, Color(


### TYP-002 [pass] (low)

- Description: Quantidade de estilos de texto dentro do esperado.

- Evidence: styles_observed = 4

- Recommendation: Manter consistência de estilos.


### SPC-001 [pass] (low)

- Description: Gaps verticais compatíveis com ritmo previsível.

- Evidence: Gaps=[16, 12]

- Recommendation: Manter ritmo de espaçamento.


### SPC-002 [pass] (low)

- Description: Padding horizontal dominante informado.

- Evidence: dominant_horizontal_padding_px=16 (confidence=0.65)

- Recommendation: Usar esse padding como keyline base e manter consistência.

- Code search hints: padding(.horizontal, safeAreaInset, layoutMargins


### LAY-001 [pass] (low)

- Description: Keylines aparentam consistentes com base nas margens/padding informados.

- Evidence: dominant_horizontal_padding_px=16; alignment_findings=2

- Recommendation: Manter consistência de margens e alinhamento interno.

- Code search hints: padding(, layoutMargins


### LAY-002 [pass] (low)

- Description: Não há achados de alinhamento com severidade alta.

- Evidence: findings=2

- Recommendation: Manter alinhamento consistente.


### COL-002 [pass] (low)

- Description: Distribuição de acento parece controlada (heurístico).

- Evidence: top_non_neutral={'color': '#030304', 'role': 'fundo principal', 'confidence': 0.7, 'evidence': 'O fundo da tela inteira é quase preto com leve brilho'}

- Recommendation: Manter acento com função clara.


### CTA-002 [pass] (low)

- Description: Sem competição relevante de CTAs.

- Evidence: cta_competition_count=4

- Recommendation: Manter foco no CTA primário.


### CTA-003 [pass] (low)

- Description: Posição do CTA primário parece adequada.

- Evidence: primary_cta_position=bottom navigation, left-most icon

- Recommendation: Manter CTA fácil de encontrar.


### TYP-001 [insufficient_data] (medium)

- Description: Sem base de parágrafo para validar escala Major Third.

- Evidence: Nenhum estilo com role=body e approx_size_px válido.

- Missing data: typography.styles_observed[role=body].approx_size_px

- Recommendation: No Visual Inspector, identifique o tamanho aproximado do corpo (body) e pelo menos 2 outros estilos.


### TYP-003 [insufficient_data] (low)

- Description: Dados insuficientes para validar direção do tracking.

- Evidence: Não foi possível identificar maior/menor estilo com approx_size_px.

- Missing data: typography.styles_observed[*].approx_size_px, typography.styles_observed[*].tracking

- Recommendation: No Visual Inspector, preencha approx_size_px e tracking para estilos maiores e menores.


### COL-001 [insufficient_data] (low)

- Description: Sem dados confiáveis de contagem de cores distintas.

- Evidence: value=6, confidence=0.4

- Missing data: color.distinct_color_count_est

- Recommendation: No Visual Inspector, estime distinct_color_count_est com confidence >= 0.6 quando houver clareza.


### CTA-001 [insufficient_data] (low)

- Description: Sem dado confiável sobre existência de CTA primário.

- Evidence: value=True, confidence=0.5

- Missing data: cta.primary_cta_present

- Recommendation: No Visual Inspector, indique se há CTA primário com confidence >= 0.6 quando for claro.

