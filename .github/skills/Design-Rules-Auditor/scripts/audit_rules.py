#!/usr/bin/env python3
"""
audit_rules.py (v2)

Mudança chave:
- LAY-001 agora audita "keylines/alinhamento interno" e NÃO o número de colunas do layout.
"""

import json, argparse, os
from typing import Any, Dict, List

def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(path: str, data: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def near_any(value: float, targets: List[float], tol: float = 2.0) -> bool:
    return any(abs(value - t) <= tol for t in targets)

def major_third_scale(base: float, steps: int = 8) -> List[float]:
    scale = [base]
    for _ in range(steps - 1):
        scale.append(scale[-1] * 1.25)
    return scale

def classify_neutral(hex_color: str) -> bool:
    hex_color = (hex_color or "").lstrip("#")
    if len(hex_color) != 6:
        return False
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return max(r,g,b) - min(r,g,b) <= 18

def add_finding(findings: List[Dict[str, Any]], rule_id: str, severity: str, status: str,
                description: str, evidence: str, recommendation: str,
                missing_data: List[str] = None, code_hints: List[str] = None):
    findings.append({
        "rule_id": rule_id,
        "severity": severity,
        "status": status,
        "description": description,
        "evidence": evidence,
        "recommendation": recommendation,
        "missing_data": missing_data or [],
        "suggested_code_search_hints": code_hints or []
    })

def audit(facts: Dict[str, Any]) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []

    typography = facts.get("typography", {}) or {}
    spacing = facts.get("spacing", {}) or {}
    layout = facts.get("layout", {}) or {}
    color = facts.get("color", {}) or {}
    cta = facts.get("cta", {}) or {}

    styles = typography.get("styles_observed", []) or []

    # ---------- Typography ----------
    # TYP-002 TooManyTextStyles
    if len(styles) == 0:
        add_finding(findings, "TYP-002", "low", "insufficient_data",
                    "Nenhum estilo de texto foi informado.",
                    "styles_observed está vazio.",
                    "Reexecutar Visual Inspector e identificar estilos de texto observados.",
                    missing_data=["typography.styles_observed"])
    elif len(styles) > 6:
        add_finding(findings, "TYP-002", "medium", "fail",
                    f"Muitos estilos de texto detectados ({len(styles)}).",
                    f"styles_observed = {len(styles)}",
                    "Reduzir estilos: consolide variações e mantenha uma hierarquia clara.",
                    code_hints=[".font(", "TextStyle", "Typography"])
    else:
        add_finding(findings, "TYP-002", "low", "pass",
                    "Quantidade de estilos de texto dentro do esperado.",
                    f"styles_observed = {len(styles)}",
                    "Manter consistência de estilos.")

    # TYP-001 MajorThirdScale
    body_sizes = [s.get("approx_size_px") for s in styles
                  if s.get("role") == "body" and isinstance(s.get("approx_size_px"), (int,float)) and s.get("approx_size_px",0) > 0]
    if not body_sizes:
        add_finding(findings, "TYP-001", "medium", "insufficient_data",
                    "Sem base de parágrafo para validar escala Major Third.",
                    "Nenhum estilo com role=body e approx_size_px válido.",
                    "No Visual Inspector, identifique o tamanho aproximado do corpo (body) e pelo menos 2 outros estilos.",
                    missing_data=["typography.styles_observed[role=body].approx_size_px"])
    else:
        base = float(sorted(body_sizes)[0])
        scale = major_third_scale(base, steps=10)
        bad = []
        for s in styles:
            sz = s.get("approx_size_px")
            if isinstance(sz, (int,float)) and sz > 0:
                if not near_any(float(sz), scale, tol=2.0):
                    bad.append({"role": s.get("role","other"), "size": sz})
        if not bad:
            add_finding(findings, "TYP-001", "low", "pass",
                        "Tamanhos aparentes compatíveis com escala Major Third (±2px).",
                        f"Base={base}px; escala≈{[round(x,1) for x in scale[:6]]} ...",
                        "Manter escala consistente.",
                        code_hints=[".font(", "TextStyle", "Typography"])
        else:
            add_finding(findings, "TYP-001", "high", "fail",
                        "Existem tamanhos fora da escala Major Third (±2px).",
                        f"Fora da escala: {bad}",
                        "Ajustar tamanhos para valores da escala derivada do body. Evitar tamanhos arbitrários.",
                        code_hints=[".font(", "TextStyle", "Typography", "Font.system"])

    # TYP-003 TrackingDirection
    if styles:
        sizes = [(s.get("approx_size_px") or 0, s) for s in styles]
        sizes.sort(key=lambda x: x[0], reverse=True)
        top = sizes[0][1] if sizes and sizes[0][0] else None
        small = sizes[-1][1] if sizes and sizes[-1][0] else None
        if not top or not small:
            add_finding(findings, "TYP-003", "low", "insufficient_data",
                        "Dados insuficientes para validar direção do tracking.",
                        "Não foi possível identificar maior/menor estilo com approx_size_px.",
                        "No Visual Inspector, preencha approx_size_px e tracking para estilos maiores e menores.",
                        missing_data=["typography.styles_observed[*].approx_size_px", "typography.styles_observed[*].tracking"])
        else:
            top_track = (top.get("tracking") or "unknown")
            small_track = (small.get("tracking") or "unknown")
            if top_track == "wide" or small_track == "tight":
                add_finding(findings, "TYP-003", "medium", "fail",
                            "Tracking aparenta contrariar a regra.",
                            f"Maior tracking={top_track}; menor tracking={small_track}",
                            "Ajustar letter spacing: feche tracking em títulos grandes e abra em textos pequenos.",
                            code_hints=[".kerning(", "tracking", "letterSpacing"])
            else:
                add_finding(findings, "TYP-003", "low", "pass",
                            "Tracking aparente compatível com a regra.",
                            f"Maior tracking={top_track}; menor tracking={small_track}",
                            "Manter consistência de tracking.")
    else:
        add_finding(findings, "TYP-003", "low", "insufficient_data",
                    "Sem estilos para validar tracking.",
                    "styles_observed vazio.",
                    "Preencher styles_observed com tracking.",
                    missing_data=["typography.styles_observed"])

    # ---------- Spacing ----------
    gaps = spacing.get("dominant_vertical_gaps_px", []) or []
    gap_vals = [g.get("value") for g in gaps if isinstance(g, dict) and isinstance(g.get("value"), (int,float)) and g.get("value",0) > 0]
    if not gap_vals:
        add_finding(findings, "SPC-001", "low", "insufficient_data",
                    "Sem dados de gaps verticais dominantes.",
                    "dominant_vertical_gaps_px vazio ou inválido.",
                    "No Visual Inspector, registre gaps verticais recorrentes (ex: 8,12,16,24).",
                    missing_data=["spacing.dominant_vertical_gaps_px"])
    else:
        allowed = [8, 12, 16, 24, 32, 40, 48]
        bad = [v for v in gap_vals if not near_any(float(v), allowed, tol=2.0)]
        if bad:
            add_finding(findings, "SPC-001", "medium", "fail",
                        "Gaps verticais sugerem ritmo inconsistente.",
                        f"Gaps={gap_vals}; fora={bad}",
                        "Padronizar gaps para um set curto (8/12/16/24/32).",
                        code_hints=["padding(", "spacing", "VStack", "Stack(spacing"])
        else:
            add_finding(findings, "SPC-001", "low", "pass",
                        "Gaps verticais compatíveis com ritmo previsível.",
                        f"Gaps={gap_vals}",
                        "Manter ritmo de espaçamento.")

    pad = spacing.get("dominant_horizontal_padding_px", {}) or {}
    pad_val = pad.get("value", 0)
    pad_conf = pad.get("confidence", 0.0) or 0.0
    if not pad_val or pad_conf < 0.6:
        add_finding(findings, "SPC-002", "low", "insufficient_data",
                    "Sem dado confiável de padding horizontal dominante.",
                    f"value={pad_val}, confidence={pad_conf}",
                    "No Visual Inspector, estime padding horizontal dominante com confidence >= 0.6 quando for claro.",
                    missing_data=["spacing.dominant_horizontal_padding_px.value", "spacing.dominant_horizontal_padding_px.confidence"])
    else:
        add_finding(findings, "SPC-002", "low", "pass",
                    "Padding horizontal dominante informado.",
                    f"dominant_horizontal_padding_px={pad_val} (confidence={pad_conf})",
                    "Usar esse padding como keyline base e manter consistência.",
                    code_hints=["padding(.horizontal", "safeAreaInset", "layoutMargins"])

    # ---------- Layout ----------
    # LAY-001 Keylines4ColumnSystem (keylines/internal alignment, not layout columns)
    aligns = layout.get("alignment_findings", []) or []
    # consider medium/high findings with confidence >=0.6 as keyline inconsistency
    keyline_issues = [a for a in aligns
                      if (a.get("severity_hint") in ("medium","high")) and (a.get("confidence",0.0) or 0.0) >= 0.6]
    if (not pad_val) or (pad_conf < 0.6):
        add_finding(findings, "LAY-001", "medium", "insufficient_data",
                    "Dados insuficientes para auditar keylines (margens/alinhamento interno).",
                    "Padding horizontal dominante ausente ou com baixa confiança.",
                    "Preencher spacing.dominant_horizontal_padding_px com confidence >= 0.6 e registrar alignment_findings quando houver offsets.",
                    missing_data=["spacing.dominant_horizontal_padding_px"])
    else:
        if keyline_issues:
            add_finding(findings, "LAY-001", "high", "fail",
                        "Inconsistências de keylines/alinhamento interno detectadas.",
                        f"dominant_horizontal_padding_px={pad_val}; issues={keyline_issues}",
                        "Padronizar keylines: alinhar conteúdo interno dos componentes nas mesmas bordas e eliminar offsets recorrentes.",
                        code_hints=["padding(", "frame(", "alignment", "HStack", "VStack", "Grid"])
        else:
            add_finding(findings, "LAY-001", "low", "pass",
                        "Keylines aparentam consistentes com base nas margens/padding informados.",
                        f"dominant_horizontal_padding_px={pad_val}; alignment_findings={len(aligns)}",
                        "Manter consistência de margens e alinhamento interno.",
                        code_hints=["padding(", "layoutMargins"])

    # LAY-002 AlignmentFindingsHigh
    high = [a for a in aligns if (a.get("severity_hint") == "high")]
    if not aligns:
        add_finding(findings, "LAY-002", "low", "insufficient_data",
                    "Sem achados de alinhamento no VISUAL_FACTS.",
                    "alignment_findings vazio.",
                    "No Visual Inspector, registre offsets/alinhamentos inconsistentes quando existirem.",
                    missing_data=["layout.alignment_findings"])
    elif high:
        add_finding(findings, "LAY-002", "high", "fail",
                    "Foram reportados problemas de alinhamento com severidade alta.",
                    f"high_findings={len(high)}",
                    "Padronizar alinhamento por borda e eliminar offsets pequenos recorrentes.",
                    code_hints=["alignment", "frame(", "padding(", "HStack", "Spacer()"])
    else:
        add_finding(findings, "LAY-002", "low", "pass",
                    "Não há achados de alinhamento com severidade alta.",
                    f"findings={len(aligns)}",
                    "Manter alinhamento consistente.")

    # ---------- Colors ----------
    dcc = color.get("distinct_color_count_est", {}) or {}
    dcc_val = dcc.get("value", 0)
    dcc_conf = dcc.get("confidence", 0.0) or 0.0
    if not dcc_val or dcc_conf < 0.6:
        add_finding(findings, "COL-001", "low", "insufficient_data",
                    "Sem dados confiáveis de contagem de cores distintas.",
                    f"value={dcc_val}, confidence={dcc_conf}",
                    "No Visual Inspector, estime distinct_color_count_est com confidence >= 0.6 quando houver clareza.",
                    missing_data=["color.distinct_color_count_est"])
    else:
        if int(dcc_val) > 6:
            add_finding(findings, "COL-001", "medium", "fail",
                        "Muitas cores distintas para uma paleta limitada.",
                        f"distinct_color_count_est={dcc_val}",
                        "Reduzir paleta e reutilizar cores por função; usar opacidade antes de criar novas cores.",
                        code_hints=["Color(", "UIColor", "Asset Catalog", "opacity("])
        else:
            add_finding(findings, "COL-001", "low", "pass",
                        "Contagem de cores compatível com paleta limitada.",
                        f"distinct_color_count_est={dcc_val}",
                        "Manter funções claras por cor.")

    dom = color.get("dominant_colors", []) or []
    if not dom:
        add_finding(findings, "COL-002", "low", "insufficient_data",
                    "Sem cores dominantes para avaliar distribuição 60:30:10.",
                    "dominant_colors vazio.",
                    "No Visual Inspector, preencha dominant_colors quando possível.",
                    missing_data=["color.dominant_colors"])
    else:
        non_neutral = [c for c in dom if not classify_neutral(c.get("hex",""))]
        if non_neutral:
            top = max(non_neutral, key=lambda c: c.get("share",0))
            if float(top.get("share",0)) > 0.18:
                add_finding(findings, "COL-002", "medium", "warning",
                            "Cor de destaque aparenta ocupar espaço demais (heurístico).",
                            f"top_non_neutral={top}",
                            "Rebalancear: neutros dominam; acento deve ser parcimonioso.",
                            code_hints=["accentColor", "tint", "foregroundStyle"])
            else:
                add_finding(findings, "COL-002", "low", "pass",
                            "Distribuição de acento parece controlada (heurístico).",
                            f"top_non_neutral={top}",
                            "Manter acento com função clara.")
        else:
            add_finding(findings, "COL-002", "low", "pass",
                        "Sem cor de destaque detectável entre as dominantes.",
                        f"dominant_colors_sample={dom[:3]}",
                        "Se houver acento, garantir função clara.")

    crh = color.get("contrast_risk_hints", []) or []
    if crh:
        add_finding(findings, "COL-003", "medium", "warning",
                    "Há indícios de risco de contraste reportados.",
                    f"contrast_risk_hints={crh}",
                    "Aumentar contraste e validar legibilidade.",
                    code_hints=["foregroundColor", "opacity(", "Color("])
    else:
        add_finding(findings, "COL-003", "low", "pass",
                    "Sem indícios de risco de contraste no VISUAL_FACTS.",
                    "contrast_risk_hints vazio.",
                    "Ainda assim, validar contraste em acessibilidade quando possível.")

    # ---------- CTA ----------
    p = cta.get("primary_cta_present", {}) or {}
    p_val = p.get("value", None)
    p_conf = p.get("confidence", 0.0) or 0.0
    if p_val is None or p_conf < 0.6:
        add_finding(findings, "CTA-001", "low", "insufficient_data",
                    "Sem dado confiável sobre existência de CTA primário.",
                    f"value={p_val}, confidence={p_conf}",
                    "No Visual Inspector, indique se há CTA primário com confidence >= 0.6 quando for claro.",
                    missing_data=["cta.primary_cta_present"])
    else:
        if p_val is False:
            add_finding(findings, "CTA-001", "high", "fail",
                        "Não foi identificado CTA primário visível.",
                        "primary_cta_present=false",
                        "Definir um CTA primário e dar destaque suficiente.",
                        code_hints=["Button(", "NavigationLink(", "onTapGesture"])
        else:
            add_finding(findings, "CTA-001", "low", "pass",
                        "CTA primário presente.",
                        "primary_cta_present=true",
                        "Manter CTA primário claro.")

    cc = cta.get("cta_competition_count", {}) or {}
    cc_val = cc.get("value", 0)
    cc_conf = cc.get("confidence", 0.0) or 0.0
    if (cc_conf < 0.6) and (cc_val == 0):
        add_finding(findings, "CTA-002", "low", "insufficient_data",
                    "Sem dado confiável sobre competição de CTAs.",
                    f"value={cc_val}, confidence={cc_conf}",
                    "No Visual Inspector, estime quantos CTAs competem na tela.",
                    missing_data=["cta.cta_competition_count"])
    else:
        if int(cc_val) >= 2 and cc_conf >= 0.6:
            add_finding(findings, "CTA-002", "medium", "warning",
                        "Existem múltiplos CTAs competindo.",
                        f"cta_competition_count={cc_val}",
                        "Escolher 1 CTA primário; rebaixar o resto para secundário/terciário.",
                        code_hints=["Button(", "toolbar", "NavigationLink("])
        else:
            add_finding(findings, "CTA-002", "low", "pass",
                        "Sem competição relevante de CTAs.",
                        f"cta_competition_count={cc_val}",
                        "Manter foco no CTA primário.")

    pos = cta.get("primary_cta_position", {}) or {}
    pos_val = pos.get("value", "unknown")
    pos_conf = pos.get("confidence", 0.0) or 0.0
    if pos_val == "unknown" or pos_conf < 0.6:
        add_finding(findings, "CTA-003", "low", "insufficient_data",
                    "Sem dado confiável sobre posição do CTA primário.",
                    f"value={pos_val}, confidence={pos_conf}",
                    "No Visual Inspector, classifique a posição do CTA (top/middle/bottom/below_fold).",
                    missing_data=["cta.primary_cta_position"])
    else:
        if pos_val == "below_fold":
            add_finding(findings, "CTA-003", "medium", "warning",
                        "CTA primário está abaixo da dobra (heurístico).",
                        "primary_cta_position=below_fold",
                        "Trazer CTA para mais perto do topo ou tornar evidente por affordance.",
                        code_hints=["ScrollView", "safeAreaInset", "toolbar", "overlay"])
        else:
            add_finding(findings, "CTA-003", "low", "pass",
                        "Posição do CTA primário parece adequada.",
                        f"primary_cta_position={pos_val}",
                        "Manter CTA fácil de encontrar.")

    return findings

def summarize(findings: List[Dict[str, Any]]) -> Dict[str, int]:
    counts = {"high":0,"medium":0,"low":0,"insufficient_data":0}
    for f in findings:
        if f["status"] == "insufficient_data":
            counts["insufficient_data"] += 1
        else:
            counts[f.get("severity","low")] += 1
    return counts

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", required=True, help="Path to VISUAL_FACTS.json")
    ap.add_argument("--out", required=True, help="Output folder (artifacts)")
    args = ap.parse_args()

    facts = load_json(args.facts)
    findings = audit(facts)

    os.makedirs(args.out, exist_ok=True)
    write_json(os.path.join(args.out, "AUDIT_FINDINGS.json"), {"findings": findings})

    meta = facts.get("meta", {})
    s = summarize(findings)

    severity_rank = {"high":0,"medium":1,"low":2}
    status_rank = {"fail":0,"warning":1,"pass":2,"insufficient_data":3}
    ordered = sorted(findings, key=lambda f: (status_rank.get(f["status"], 9), severity_rank.get(f["severity"], 9)))

    lines = []
    lines.append("# Audit Report\n")
    lines.append("## Meta\n")
    lines.append(f"- Screen: {meta.get('screen_name','') or 'unknown'}\n")
    lines.append(f"- Platform: {meta.get('platform','unknown')}\n")
    lines.append(f"- Device: {meta.get('device','unknown')}\n")
    lines.append(f"- Mode: {meta.get('mode','unknown')}\n")
    lines.append(f"- Images: {', '.join([i.get('file','') for i in meta.get('images',[])]) or 'unknown'}\n")

    lines.append("\n## Summary\n")
    lines.append(f"- Total findings: {len(findings)}\n")
    lines.append(f"- High: {s['high']}\n")
    lines.append(f"- Medium: {s['medium']}\n")
    lines.append(f"- Low: {s['low']}\n")
    lines.append(f"- Insufficient data: {s['insufficient_data']}\n")

    lines.append("\n## Findings (ordered)\n")
    for f in ordered:
        lines.append(f"### {f['rule_id']} [{f['status']}] ({f['severity']})\n")
        lines.append(f"- Description: {f['description']}\n")
        lines.append(f"- Evidence: {f['evidence']}\n")
        if f.get("missing_data"):
            lines.append(f"- Missing data: {', '.join(f['missing_data'])}\n")
        lines.append(f"- Recommendation: {f['recommendation']}\n")
        if f.get("suggested_code_search_hints"):
            lines.append(f"- Code search hints: {', '.join(f['suggested_code_search_hints'])}\n")
        lines.append("")

    with open(os.path.join(args.out, "AUDIT_REPORT.md"), "w", encoding="utf-8") as rf:
        rf.write("\n".join(lines))

if __name__ == "__main__":
    main()
